import type { RequestHandler } from "express";
import { AppConstants } from "../../constants";
import { env } from "../../config/env";
import { parseDurationToMs } from "../utils/duration.util";
import jwtService, { type TokenUserKind } from "../../utils/auth/jwt.util";
import { UnauthorizedError } from "../errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        kind?: TokenUserKind;
        role?: string;
        sessionId?: string;
        deviceId?: string;
      };
    }
  }
}

/**
 * Verifies the access token, validates the embedded session is still active in
 * DB (single-device enforcement), and binds `req.user`. The token carries a
 * `kind` discriminator so callers know which collection to dereference.
 *
 * `skipSession: true` allows legacy tokens that lack a sessionId — used only
 * for the brief window where pre-session tokens may still be in flight.
 */
export class AuthMiddleware {
  constructor(private readonly opts: { skipSession?: boolean } = {}) {}

  public handle: RequestHandler = async (req, _res, next) => {
    const token = AuthMiddleware.extractToken(req);
    if (!token) {
      next(new UnauthorizedError("Not authenticated"));
      return;
    }

    let payload: ReturnType<typeof jwtService.verifyAccessToken>;
    try {
      payload = jwtService.verifyAccessToken(token);
    } catch {
      next(new UnauthorizedError("Token invalid or expired"));
      return;
    }

    const user: {
      id: string;
      kind?: TokenUserKind;
      role?: string;
      sessionId?: string;
      deviceId?: string;
    } = { id: payload.id, kind: payload.kind };
    if (payload.role !== undefined) user.role = payload.role;
    if (payload.sessionId !== undefined) user.sessionId = payload.sessionId;
    if (payload.deviceId !== undefined) user.deviceId = payload.deviceId;

    if (!this.opts.skipSession && payload.sessionId && payload.kind) {
      const headerDeviceId =
        typeof req.headers["x-device-id"] === "string" ? req.headers["x-device-id"] : null;
      const sessionDeviceId = payload.deviceId ?? headerDeviceId ?? "oauth-issued";
      try {
        const sessions = await AuthMiddleware.loadSessionService();
        const session = await sessions.validateOrRehydrate(payload.sessionId, {
          userId: payload.id,
          userKind: payload.kind,
          deviceId: sessionDeviceId,
          refreshTokenHash: "rehydrated",
          ...(typeof req.headers["user-agent"] === "string" && {
            userAgent: req.headers["user-agent"],
          }),
          ...(req.ip !== undefined && { ip: req.ip }),
          expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN)),
        });
        // Sessions created via OAuth top-level redirects can't see the
        // frontend's x-device-id header — we stamp them with a "portable"
        // sentinel and skip the device-mismatch guard for them. Same for
        // legacy "unknown-device" rows from before the OAuth fix landed.
        const PORTABLE_DEVICE_IDS = new Set(["oauth-issued", "unknown-device"]);
        const sessionIsPortable = !session.deviceId || PORTABLE_DEVICE_IDS.has(session.deviceId);
        if (headerDeviceId && !sessionIsPortable && headerDeviceId !== session.deviceId) {
          await sessions.revoke(payload.sessionId, "device-mismatch");
          next(new UnauthorizedError("Session invalidated: device mismatch"));
          return;
        }
        void sessions.touch(payload.sessionId);
      } catch (err) {
        // validateOrRehydrate only throws on explicit revocation. Anything
        // else (DB write hiccup, race during rehydrate) is treated as
        // non-fatal — the JWT itself remains valid.
        if (err instanceof UnauthorizedError) {
          next(err);
          return;
        }
      }
    }

    req.user = user;
    next();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static _sessionService: any = null;
  private static async loadSessionService() {
    if (!this._sessionService) {
      const mod = await import("../../modules/session/session.module");
      this._sessionService = mod.SessionModule.service();
    }
    return this._sessionService;
  }

  private static extractToken(req: Parameters<RequestHandler>[0]): string | null {
    const auth = req.headers.authorization;
    if (typeof auth === "string" && auth.startsWith("Bearer ")) {
      return auth.slice("Bearer ".length).trim() || null;
    }
    const cookieToken = (req.cookies as Record<string, unknown> | undefined)?.[
      AppConstants.AUTH_COOKIE_NAME
    ];
    return typeof cookieToken === "string" && cookieToken.length > 0 ? cookieToken : null;
  }

  static create(opts: { skipSession?: boolean } = {}): RequestHandler {
    return new AuthMiddleware(opts).handle;
  }
}
