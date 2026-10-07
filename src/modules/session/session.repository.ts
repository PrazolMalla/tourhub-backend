import { BaseRepository } from "../../core/base/base.repository";
import {
  SessionModel,
  type SessionDoc,
  type SessionDocument,
  type SessionUserKind,
} from "./session.model";

export class SessionRepository extends BaseRepository<SessionDoc> {
  constructor() {
    super(SessionModel);
  }

  async findActiveBySessionId(sessionId: string): Promise<SessionDocument | null> {
    return this.model.findOne({
      sessionId,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });
  }

  async findBySessionId(sessionId: string): Promise<SessionDocument | null> {
    return this.model.findOne({ sessionId });
  }

  async findActiveByRefreshHash(hash: string): Promise<SessionDocument | null> {
    return this.model.findOne({
      refreshTokenHash: hash,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });
  }

  async findAllActiveForUser(
    userId: string,
    userKind: SessionUserKind,
  ): Promise<SessionDocument[]> {
    return this.model.find({
      userId,
      userKind,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });
  }

  async revokeAllForUser(
    userId: string,
    userKind: SessionUserKind,
    reason: string,
  ): Promise<number> {
    const res = await this.model.updateMany(
      { userId, userKind, revokedAt: { $exists: false } },
      { revokedAt: new Date(), revokedReason: reason },
    );
    return res.modifiedCount ?? 0;
  }

  async revokeAllForUserExcept(
    userId: string,
    userKind: SessionUserKind,
    keepSessionId: string,
    reason: string,
  ): Promise<number> {
    const res = await this.model.updateMany(
      { userId, userKind, sessionId: { $ne: keepSessionId }, revokedAt: { $exists: false } },
      { revokedAt: new Date(), revokedReason: reason },
    );
    return res.modifiedCount ?? 0;
  }

  async revokeBySessionId(sessionId: string, reason: string): Promise<void> {
    await this.model.updateOne(
      { sessionId, revokedAt: { $exists: false } },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  async rotateRefreshHash(sessionId: string, newHash: string, newExpiresAt: Date): Promise<void> {
    await this.model.updateOne(
      { sessionId },
      { refreshTokenHash: newHash, expiresAt: newExpiresAt, lastActivityAt: new Date() },
    );
  }

  async touch(sessionId: string): Promise<void> {
    await this.model.updateOne({ sessionId }, { lastActivityAt: new Date() });
  }
}
