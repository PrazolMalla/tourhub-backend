import bcrypt from "bcryptjs";
import { Types, type HydratedDocument } from "mongoose";
import { BaseService } from "../../core/base/base.service";
import { ConflictError, ForbiddenError, HttpError, UnauthorizedError } from "../../core/errors";
import { parseDurationToMs } from "../../core/utils/duration.util";
import { env } from "../../config/env";
import emailConfig from "../../config/emailConfig";
import jwtService, { type TokenUserKind } from "../../utils/auth/jwt.util";
import { OtpUtil } from "../../utils/auth/otp.util";
import { AuthRepository } from "./auth.repository";
import { AdminRepository } from "../admin/admin.repository";
import { RefreshTokenRepository } from "./refresh-token.repository";
import { SessionModule } from "../session/session.module";
import type {
  AuthTokens,
  ForgetPasswordInput,
  LoginContext,
  LoginInput,
  RegisterInput,
  ResendOtpInput,
  ResetPasswordInput,
} from "./auth.types";
import type { OAuthProfile } from "./oauth/oauth.types";
import type { UserDoc, UserDocument } from "../user/user.model";
import type { AdminDoc, AdminDocument, AdminRole } from "../admin/admin.model";

const OTP_EXPIRY_MS = 15 * 60 * 1000;

/** Common subset that lookup/login paths return regardless of kind. */
type AnyAccountDocument = UserDocument | AdminDocument;

export class AuthService extends BaseService<AuthRepository> {
  constructor(
    repository: AuthRepository,
    private readonly admins: AdminRepository,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {
    super(repository);
  }

  // ─── Customer flows ──────────────────────────────────────────────────────

  async register(input: RegisterInput, ctx?: LoginContext): Promise<AuthTokens> {
    const existing = await this.repository.findByEmailWithSecrets(input.email);
    if (existing) throw new ConflictError("Email already in use");

    const hashed = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
    const payload: Partial<UserDoc> = {
      email: input.email,
      password: hashed,
    };
    if (input.name !== undefined) payload.name = input.name;

    const user = await this.repository.create(payload);
    return this.issueTokensAndSession(user, "user", ctx ?? {});
  }

  /**
   * Customer login (the user-facing site). Admins log in via `adminLogin`,
   * which queries a different collection entirely.
   */
  async login(input: LoginInput, ctx: LoginContext = {}): Promise<AuthTokens> {
    const user = await this.repository.findByEmailWithSecrets(input.email);

    const auditFailure = async (message: string) => {};

    if (!user || !user.password) {
      await auditFailure("no-user");
      throw new UnauthorizedError("Invalid credentials");
    }

    // Verify the password BEFORE revealing account status — otherwise anyone
    // who knows an email can learn that it exists and is blocked/inactive.
    const ok = await bcrypt.compare(input.password, user.password);
    if (!ok) {
      await auditFailure("bad-password");
      throw new UnauthorizedError("Invalid credentials");
    }
    if (user.isBanned) {
      await auditFailure("banned");
      throw new ForbiddenError("Account is blocked");
    }
    if (!user.isActive) {
      await auditFailure("inactive");
      throw new ForbiddenError("Account is inactive");
    }

    const tokens = await this.issueTokensAndSession(user, "user", ctx);

    return tokens;
  }

  // ─── Admin flows ─────────────────────────────────────────────────────────

  async adminLogin(input: LoginInput, ctx: LoginContext = {}): Promise<AuthTokens> {
    const admin = await this.admins.findByEmailWithSecrets(input.email);

    const auditFailure = async (message: string) => {};

    if (!admin || !admin.password) {
      await auditFailure("no-admin");
      throw new UnauthorizedError("Invalid credentials");
    }

    // Password first — see login().
    const ok = await bcrypt.compare(input.password, admin.password);
    if (!ok) {
      await auditFailure("bad-password");
      throw new UnauthorizedError("Invalid credentials");
    }
    if (admin.isBanned) {
      await auditFailure("banned");
      throw new ForbiddenError("Account is blocked. Contact your administrator.");
    }
    if (!admin.isActive) {
      await auditFailure("inactive");
      throw new ForbiddenError("Account is inactive");
    }

    const tokens = await this.issueTokensAndSession(admin, "admin", ctx);

    return tokens;
  }

  // ─── Shared: refresh / logout ────────────────────────────────────────────

  async refresh(currentRefreshToken: string, ctx: LoginContext = {}): Promise<AuthTokens> {
    let payload: { id: string; kind: TokenUserKind; sessionId?: string };
    try {
      payload = jwtService.verifyRefreshToken(currentRefreshToken);
    } catch {
      throw new UnauthorizedError("Refresh token invalid or expired");
    }

    const hash = jwtService.hashToken(currentRefreshToken);
    const stored = await this.refreshTokens.findByHash(hash);

    // Reuse detection (security-critical): only meaningful when we have a
    // stored row AND it's already revoked. Missing rows are treated as
    // "DB doesn't know about it" (likely wipe/restart), not as reuse.
    if (stored?.revokedAt) {
      await this.refreshTokens.revokeAllForUser(payload.id, payload.kind);
      await SessionModule.service().revokeAllForUser(payload.id, payload.kind, "refresh-reuse");
      throw new UnauthorizedError("Refresh token reuse detected; please re-authenticate");
    }

    const account = await this.findByIdForKind(payload.id, payload.kind);
    if (!account) throw new UnauthorizedError("Account no longer exists");
    if (account.isBanned) {
      throw new ForbiddenError(
        payload.kind === "admin"
          ? "Account is blocked. Contact your administrator."
          : "Account is blocked",
      );
    }
    // A deactivated account must not be able to mint new tokens either.
    if (!account.isActive) throw new ForbiddenError("Account is inactive");

    // Session row is advisory — only an explicit revocation kicks the user.
    // Missing rows are rehydrated so a wiped DB doesn't force re-login while
    // the JWT is still valid.
    if (payload.sessionId) {
      await SessionModule.service().validateOrRehydrate(payload.sessionId, {
        userId: account._id.toString(),
        userKind: payload.kind,
        deviceId: ctx.deviceId ?? "oauth-issued",
        refreshTokenHash: "rehydrated",
        ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
        ...(ctx.browser !== undefined && { browser: ctx.browser }),
        ...(ctx.os !== undefined && { os: ctx.os }),
        ...(ctx.ip !== undefined && { ip: ctx.ip }),
        expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN)),
      });
    }

    const role = "role" in account ? account.role : undefined;
    const accessToken = jwtService.generateAccessToken({
      id: account._id.toString(),
      kind: payload.kind,
      ...(role && { role }),
      ...(payload.sessionId && { sessionId: payload.sessionId }),
      ...(ctx.deviceId && { deviceId: ctx.deviceId }),
    });
    const refreshToken = jwtService.generateRefreshToken({
      id: account._id.toString(),
      kind: payload.kind,
      ...(payload.sessionId && { sessionId: payload.sessionId }),
    });

    const newHash = jwtService.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN));

    await this.refreshTokens.create({
      tokenHash: newHash,
      userId: new Types.ObjectId(account._id.toString()),
      userKind: payload.kind,
      expiresAt,
    });
    if (stored) {
      await this.refreshTokens.revoke(hash, newHash);
    }

    if (payload.sessionId) {
      await SessionModule.service().rotateRefresh(payload.sessionId, newHash, expiresAt);
    }

    return { accessToken, refreshToken };
  }

  async logout(refreshToken: string | undefined, ctx: LoginContext = {}): Promise<void> {
    if (!refreshToken) return;
    let payload: { id: string; kind: TokenUserKind; sessionId?: string };
    try {
      payload = jwtService.verifyRefreshToken(refreshToken);
    } catch {
      return;
    }
    const hash = jwtService.hashToken(refreshToken);
    await this.refreshTokens.revoke(hash);
    if (payload.sessionId) {
      await SessionModule.service().revoke(payload.sessionId, "user-logout");
    }
  }

  // ─── Password reset (customer only — admins reset via SuperAdmin) ────────

  async forgetPassword(input: ForgetPasswordInput): Promise<void> {
    const user = await this.repository.findByEmailWithSecrets(input.email);
    if (!user) return;

    const otp = OtpUtil.generateNumericOTP();
    const otpHash = await bcrypt.hash(otp, env.BCRYPT_SALT_ROUNDS);
    const expiry = new Date(Date.now() + OTP_EXPIRY_MS);
    await this.repository.setOtp(user._id.toString(), otpHash, expiry);

    await emailConfig.sendEmail({
      to: input.email,
      subject: "Your Password Reset OTP",
      template: "otp",
      data: { otp },
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const user = await this.repository.findByEmailWithSecrets(input.email);
    if (!user || !user.resetOtp || !user.otpExpiry) {
      throw HttpError.badRequest("Invalid or expired OTP");
    }
    if (Date.now() > user.otpExpiry.getTime()) {
      throw HttpError.badRequest("OTP has expired");
    }

    const ok = await bcrypt.compare(input.otp, user.resetOtp);
    if (!ok) throw HttpError.badRequest("Invalid or expired OTP");

    const hashed = await bcrypt.hash(input.newPassword, env.BCRYPT_SALT_ROUNDS);
    await this.repository.setPassword(user._id.toString(), hashed);

    await this.refreshTokens.revokeAllForUser(user._id.toString(), "user");
    await SessionModule.service().revokeAllForUser(user._id.toString(), "user", "password-reset");
  }

  async resendOtp(input: ResendOtpInput): Promise<void> {
    return this.forgetPassword(input);
  }

  // ─── OAuth ───────────────────────────────────────────────────────────────

  /**
   * Customer-side Google OAuth. Looks up / creates / links the account in the
   * `users` collection only.
   */
  async loginCustomerWithGoogle(
    profile: OAuthProfile,
    ctx: LoginContext = {},
  ): Promise<AuthTokens> {
    if (profile.provider !== "google") {
      throw new Error(`loginCustomerWithGoogle called with provider=${profile.provider}`);
    }
    const email = profile.email.toLowerCase();
    let user = await this.repository.findByGoogleId(profile.providerId);

    if (!user) {
      const byEmail = await this.repository.findByEmail(email);
      if (byEmail) {
        await this.repository.linkGoogleId(byEmail._id.toString(), profile.providerId);
        user = byEmail;
      } else {
        const data: Partial<UserDoc> = { email, googleId: profile.providerId };
        if (profile.name) data.name = profile.name;
        user = await this.repository.create(data);
      }
    }

    if (user.isBanned) throw new ForbiddenError("Account is blocked");
    if (!user.isActive) throw new ForbiddenError("Account is inactive");

    const tokens = await this.issueTokensAndSession(user, "user", ctx);

    return tokens;
  }

  /**
   * Admin-portal Google OAuth. Only existing admin accounts can complete the
   * flow. Unknown emails get persisted as a blocked admin shell so SuperAdmin
   * can audit / unblock the attempt from the panel.
   */
  async loginAdminWithGoogle(
    profile: OAuthProfile,
    ctx: LoginContext = {},
    autoBlockUnauthorized = true,
  ): Promise<AuthTokens> {
    if (profile.provider !== "google") {
      throw new Error(`loginAdminWithGoogle called with provider=${profile.provider}`);
    }
    const email = profile.email.toLowerCase();
    const blockReason = "Unauthorized OAuth attempt on admin portal";

    let admin = await this.admins.findByGoogleId(profile.providerId);
    if (!admin) {
      const byEmail = await this.admins.findByEmail(email);
      if (byEmail) {
        await this.admins.linkGoogleId(byEmail._id.toString(), profile.providerId);
        admin = byEmail;
      } else {
        if (autoBlockUnauthorized) {
          const shell: Partial<AdminDoc> = {
            email,
            googleId: profile.providerId,
            role: "admin" as AdminRole,
            isBanned: true,
            bannedReason: blockReason,
            bannedAt: new Date(),
            isActive: true,
          };
          if (profile.name) shell.name = profile.name;
          await this.admins.create(shell);
        }
        throw new ForbiddenError("This account is not authorized for the admin portal");
      }
    }

    if (admin.isBanned) {
      throw new ForbiddenError("Account is blocked. Contact your administrator.");
    }
    if (!admin.isActive) {
      throw new ForbiddenError("Account is inactive");
    }

    const tokens = await this.issueTokensAndSession(admin, "admin", ctx);

    return tokens;
  }

  // ─── Current account lookup (kind-aware /auth/me) ────────────────────────

  /**
   * Resolves the current actor regardless of whether they're a customer or
   * an admin. Returned shape matches whichever collection holds them, plus
   * a `kind` discriminator so the frontend can render role-specific UI.
   */
  async getCurrentAccount(
    id: string,
    kind: TokenUserKind,
  ): Promise<{
    id: string;
    kind: TokenUserKind;
    email: string;
    name?: string;
    role?: string;
    isActive: boolean;
    isBanned: boolean;
    bannedReason?: string;
    bannedAt?: Date;
    phone?: string;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const account = await this.findByIdForKind(id, kind);
    if (!account) {
      throw new UnauthorizedError("Account no longer exists");
    }
    const role = "role" in account ? (account as AdminDocument).role : undefined;
    const dto: Awaited<ReturnType<AuthService["getCurrentAccount"]>> = {
      id: account._id.toString(),
      kind,
      email: account.email,
      isActive: account.isActive,
      isBanned: account.isBanned,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
    if (account.name !== undefined) dto.name = account.name;
    if (role) dto.role = role;
    if (account.bannedReason !== undefined) dto.bannedReason = account.bannedReason;
    if (account.bannedAt !== undefined) dto.bannedAt = account.bannedAt;
    if (account.phone !== undefined) dto.phone = account.phone;
    if (account.lastLoginAt !== undefined) dto.lastLoginAt = account.lastLoginAt;
    return dto;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async findByIdForKind(
    id: string,
    kind: TokenUserKind,
  ): Promise<HydratedDocument<UserDoc> | HydratedDocument<AdminDoc> | null> {
    if (kind === "admin") {
      return this.admins.findById(id);
    }
    return this.repository.findById(id);
  }

  private async issueTokensAndSession(
    account: AnyAccountDocument,
    kind: TokenUserKind,
    ctx: LoginContext,
  ): Promise<AuthTokens> {
    const id = account._id.toString();
    // OAuth top-level redirects can't carry x-device-id. We stamp the
    // session row with "oauth-issued" and OMIT deviceId from the JWT so
    // AuthMiddleware's device-mismatch guard is skipped (its precondition
    // is `payload.deviceId && ...`).
    const hasDeviceId = !!ctx.deviceId;
    const sessionDeviceId = ctx.deviceId ?? "oauth-issued";

    const session = await SessionModule.service().createAndEnforceSingleDevice({
      userId: id,
      userKind: kind,
      deviceId: sessionDeviceId,
      refreshTokenHash: "pending",
      ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
      ...(ctx.browser !== undefined && { browser: ctx.browser }),
      ...(ctx.os !== undefined && { os: ctx.os }),
      ...(ctx.ip !== undefined && { ip: ctx.ip }),
      expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN)),
    });

    const role = "role" in account ? (account as AdminDocument).role : undefined;
    const accessToken = jwtService.generateAccessToken({
      id,
      kind,
      ...(role && { role }),
      sessionId: session.sessionId,
      ...(hasDeviceId && { deviceId: sessionDeviceId }),
    });
    const refreshToken = jwtService.generateRefreshToken({
      id,
      kind,
      sessionId: session.sessionId,
    });

    const refreshHash = jwtService.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN));
    await this.refreshTokens.create({
      tokenHash: refreshHash,
      userId: new Types.ObjectId(id),
      userKind: kind,
      expiresAt,
    });
    await SessionModule.service().rotateRefresh(session.sessionId, refreshHash, expiresAt);

    if (kind === "admin") {
      await this.admins.updateLastLogin(id, ctx.ip);
    } else {
      await this.repository.updateLastLogin(id, ctx.ip);
    }

    return { accessToken, refreshToken };
  }
}
