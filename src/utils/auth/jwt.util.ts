import crypto from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";

export type TokenUserKind = "user" | "admin";

export interface AccessTokenPayload {
  id: string;
  kind: TokenUserKind;
  role?: string;
  sessionId?: string;
  deviceId?: string;
}

export interface RefreshTokenPayload {
  id: string;
  kind: TokenUserKind;
  sessionId?: string;
}

export class JwtService {
  generateAccessToken(payload: AccessTokenPayload): string {
    const options = { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as SignOptions;
    return jwt.sign(payload, env.JWT_SECRET, options);
  }

  generateRefreshToken(payload: RefreshTokenPayload): string {
    const options = { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as SignOptions;
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== "object" || decoded === null || typeof decoded.id !== "string") {
      throw new Error("Invalid access token payload");
    }
    // Tokens minted before the user/admin split don't carry `kind` — treat
    // them as the customer side by default. Admin tokens before the split
    // also won't have `kind` but their existing sessions are forcibly
    // re-issued by the migration on boot.
    const kind: TokenUserKind = decoded.kind === "admin" ? "admin" : "user";
    const payload: AccessTokenPayload = { id: decoded.id, kind };
    if (typeof decoded.role === "string") payload.role = decoded.role;
    if (typeof decoded.sessionId === "string") payload.sessionId = decoded.sessionId;
    if (typeof decoded.deviceId === "string") payload.deviceId = decoded.deviceId;
    return payload;
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
    if (typeof decoded !== "object" || decoded === null || typeof decoded.id !== "string") {
      throw new Error("Invalid refresh token payload");
    }
    const kind: TokenUserKind = decoded.kind === "admin" ? "admin" : "user";
    const payload: RefreshTokenPayload = { id: decoded.id, kind };
    if (typeof decoded.sessionId === "string") payload.sessionId = decoded.sessionId;
    return payload;
  }

  hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}

export default new JwtService();
