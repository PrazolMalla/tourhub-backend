import crypto from "crypto";
import { Types } from "mongoose";
import { BaseService } from "../../core/base/base.service";
import { NotFoundError, UnauthorizedError } from "../../core/errors";
import { SessionRepository } from "./session.repository";
import type { SessionDocument, SessionUserKind } from "./session.model";

export interface CreateSessionInput {
  userId: string;
  userKind: SessionUserKind;
  deviceId: string;
  refreshTokenHash: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  ip?: string;
  expiresAt: Date;
}

export interface SessionDTO {
  id: string;
  sessionId: string;
  userKind: SessionUserKind;
  deviceId: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  ip?: string;
  loginAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
}

export class SessionService extends BaseService<SessionRepository> {
  /**
   * Creates a new session row. Other active sessions for the same user are
   * left alone — the JWT itself is the source of truth for authentication,
   * and session rows exist to power "list / revoke device" features, not to
   * forcibly log out other tabs/devices on a fresh login.
   *
   * Method name preserved for back-compat with existing callers.
   */
  async createAndEnforceSingleDevice(input: CreateSessionInput): Promise<SessionDocument> {
    const sessionId = crypto.randomBytes(24).toString("hex");

    const doc = await this.repository.create({
      userId: new Types.ObjectId(input.userId),
      userKind: input.userKind,
      sessionId,
      deviceId: input.deviceId,
      refreshTokenHash: input.refreshTokenHash,
      ...(input.userAgent !== undefined && { userAgent: input.userAgent }),
      ...(input.browser !== undefined && { browser: input.browser }),
      ...(input.os !== undefined && { os: input.os }),
      ...(input.ip !== undefined && { ip: input.ip }),
      expiresAt: input.expiresAt,
    });

    return doc;
  }

  async validateActive(sessionId: string): Promise<SessionDocument> {
    const doc = await this.repository.findActiveBySessionId(sessionId);
    if (!doc) throw new NotFoundError("Session not active");
    return doc;
  }

  /**
   * Lenient session check used by AuthMiddleware and the refresh flow.
   *
   * Trust the JWT as the source of truth — as long as it verifies and is
   * unexpired, the user stays logged in. The session row is advisory: it
   * powers the "list / revoke device" UX, not authentication itself.
   *
   * - Explicit revocation (`revokedAt` set) → reject. Honors logout, password
   *   reset, refresh-reuse detection, and admin-initiated device revocation.
   * - Row missing (DB wiped, server restarted against a different DB, row
   *   never persisted) → rehydrate it from the JWT-bound sessionId so the
   *   user isn't kicked for ops/infra reasons.
   * - Row present but expiresAt in the past → bump expiresAt forward.
   */
  async validateOrRehydrate(
    sessionId: string,
    hydrate: CreateSessionInput,
  ): Promise<SessionDocument> {
    const existing = await this.repository.findBySessionId(sessionId);
    if (existing) {
      if (existing.revokedAt) {
        throw new UnauthorizedError("Session revoked");
      }
      if (existing.expiresAt.getTime() < Date.now()) {
        await this.repository.rotateRefreshHash(
          sessionId,
          existing.refreshTokenHash,
          hydrate.expiresAt,
        );
      }
      return existing;
    }

    return this.repository.create({
      userId: new Types.ObjectId(hydrate.userId),
      userKind: hydrate.userKind,
      sessionId,
      deviceId: hydrate.deviceId,
      refreshTokenHash: hydrate.refreshTokenHash,
      ...(hydrate.userAgent !== undefined && { userAgent: hydrate.userAgent }),
      ...(hydrate.browser !== undefined && { browser: hydrate.browser }),
      ...(hydrate.os !== undefined && { os: hydrate.os }),
      ...(hydrate.ip !== undefined && { ip: hydrate.ip }),
      expiresAt: hydrate.expiresAt,
    });
  }

  async listForUser(userId: string, userKind: SessionUserKind): Promise<SessionDTO[]> {
    const docs = await this.repository.findAllActiveForUser(userId, userKind);
    return docs.map((d) => this.toDTO(d));
  }

  async revoke(sessionId: string, reason = "user-logout"): Promise<void> {
    await this.repository.revokeBySessionId(sessionId, reason);
  }

  async revokeAllForUser(
    userId: string,
    userKind: SessionUserKind,
    reason: string,
  ): Promise<number> {
    return this.repository.revokeAllForUser(userId, userKind, reason);
  }

  async rotateRefresh(
    sessionId: string,
    newRefreshTokenHash: string,
    newExpiresAt: Date,
  ): Promise<void> {
    await this.repository.rotateRefreshHash(sessionId, newRefreshTokenHash, newExpiresAt);
  }

  async touch(sessionId: string): Promise<void> {
    await this.repository.touch(sessionId);
  }

  private toDTO(doc: SessionDocument): SessionDTO {
    const dto: SessionDTO = {
      id: doc._id.toString(),
      sessionId: doc.sessionId,
      userKind: doc.userKind,
      deviceId: doc.deviceId,
      loginAt: doc.loginAt,
      lastActivityAt: doc.lastActivityAt,
      expiresAt: doc.expiresAt,
    };
    if (doc.userAgent !== undefined) dto.userAgent = doc.userAgent;
    if (doc.browser !== undefined) dto.browser = doc.browser;
    if (doc.os !== undefined) dto.os = doc.os;
    if (doc.ip !== undefined) dto.ip = doc.ip;
    if (doc.revokedAt !== undefined) dto.revokedAt = doc.revokedAt;
    return dto;
  }
}
