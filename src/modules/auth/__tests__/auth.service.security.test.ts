/**
 * Security-sensitive AuthService paths not covered by auth.service.test.ts:
 * account-status checks, refresh edge cases, and Google OAuth for both
 * portals (linking, shell creation, blocking).
 */
jest.mock("bcryptjs", () => ({
  __esModule: true,
  default: {
    hash: jest.fn(async (val: string) => `hashed:${val}`),
    compare: jest.fn(async (val: string, hash: string) => hash === `hashed:${val}`),
  },
}));

jest.mock("../../../utils/auth/jwt.util", () => ({
  __esModule: true,
  default: {
    generateAccessToken: jest.fn(() => "access-token"),
    generateRefreshToken: jest.fn(() => "refresh-token"),
    verifyAccessToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
    hashToken: jest.fn((t: string) => `hash:${t}`),
  },
}));

jest.mock("../../../config/emailConfig", () => ({
  __esModule: true,
  default: { sendEmail: jest.fn(), initializeEmail: jest.fn() },
}));

const sessions = {
  createAndEnforceSingleDevice: jest.fn().mockResolvedValue({ sessionId: "sess-1" }),
  rotateRefresh: jest.fn(),
  revoke: jest.fn(),
  revokeAllForUser: jest.fn(),
  validateOrRehydrate: jest.fn(),
};
jest.mock("../../session/session.module", () => ({
  SessionModule: { service: () => sessions },
}));

import jwtService from "../../../utils/auth/jwt.util";
import { AuthService } from "../auth.service";
import type { AuthRepository } from "../auth.repository";
import type { AdminRepository } from "../../admin/admin.repository";
import type { RefreshTokenRepository } from "../refresh-token.repository";
import { ForbiddenError, HttpError, UnauthorizedError } from "../../../core/errors";

const UID = "507f1f77bcf86cd799439011";
const verifyRefresh = jwtService.verifyRefreshToken as jest.Mock;
const generateAccess = jwtService.generateAccessToken as jest.Mock;

const account = (o: Record<string, unknown> = {}) => ({
  _id: { toString: () => UID },
  email: "a@b.com",
  password: "hashed:right-password",
  isActive: true,
  isBanned: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...o,
});

const repoMock = () => ({
  findByEmailWithSecrets: jest.fn(),
  findByEmail: jest.fn(),
  findByGoogleId: jest.fn(),
  linkGoogleId: jest.fn(),
  setOtp: jest.fn(),
  setPassword: jest.fn(),
  updateLastLogin: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
});

const refreshMock = () => ({
  findByHash: jest.fn(),
  revoke: jest.fn(),
  revokeAllForUser: jest.fn(),
  create: jest.fn(),
});

const google = (o: Record<string, unknown> = {}) => ({
  provider: "google" as const,
  providerId: "g-sub-1",
  email: "Someone@Example.com",
  name: "Some One",
  ...o,
});

describe("AuthService (security paths)", () => {
  let users: ReturnType<typeof repoMock>;
  let admins: ReturnType<typeof repoMock>;
  let refresh: ReturnType<typeof refreshMock>;
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    users = repoMock();
    admins = repoMock();
    refresh = refreshMock();
    service = new AuthService(
      users as unknown as AuthRepository,
      admins as unknown as AdminRepository,
      refresh as unknown as RefreshTokenRepository,
    );
  });

  describe.each([
    ["login", "users", "Account is blocked"],
    ["adminLogin", "admins", "Account is blocked. Contact your administrator."],
  ] as const)("%s", (method, repoName, blockedMsg) => {
    const repo = () => (repoName === "users" ? users : admins);

    it("does not reveal ban/inactive status to a wrong password (no enumeration)", async () => {
      for (const o of [{ isBanned: true }, { isActive: false }]) {
        repo().findByEmailWithSecrets.mockResolvedValue(account(o));
        const err = await service[method]({ email: "a@b.com", password: "guess" }).catch((e) => e);
        expect(err).toBeInstanceOf(UnauthorizedError);
        expect(err.message).toBe("Invalid credentials");
      }
    });

    it("reports a block only after the correct password", async () => {
      repo().findByEmailWithSecrets.mockResolvedValue(account({ isBanned: true }));
      const err = await service[method]({ email: "a@b.com", password: "right-password" }).catch(
        (e) => e,
      );
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.message).toBe(blockedMsg);
    });

    it("rejects an inactive account with the correct password", async () => {
      repo().findByEmailWithSecrets.mockResolvedValue(account({ isActive: false }));
      await expect(
        service[method]({ email: "a@b.com", password: "right-password" }),
      ).rejects.toThrow("Account is inactive");
    });

    it("rejects unknown and password-less (OAuth-only) accounts identically", async () => {
      repo().findByEmailWithSecrets.mockResolvedValueOnce(null);
      repo().findByEmailWithSecrets.mockResolvedValueOnce(account({ password: undefined }));
      for (let i = 0; i < 2; i++) {
        await expect(service[method]({ email: "x@y.com", password: "p" })).rejects.toThrow(
          "Invalid credentials",
        );
      }
    });
  });

  it("adminLogin issues an admin token carrying the role and records the login", async () => {
    admins.findByEmailWithSecrets.mockResolvedValue(account({ role: "superadmin" }));
    await expect(
      service.adminLogin({ email: "a@b.com", password: "right-password" }, { ip: "1.2.3.4" }),
    ).resolves.toEqual({ accessToken: "access-token", refreshToken: "refresh-token" });
    expect(generateAccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: UID, kind: "admin", role: "superadmin", sessionId: "sess-1" }),
    );
    expect(admins.updateLastLogin).toHaveBeenCalledWith(UID, "1.2.3.4");
    expect(users.updateLastLogin).not.toHaveBeenCalled();
  });

  describe("refresh", () => {
    beforeEach(() => {
      verifyRefresh.mockReturnValue({ id: UID, kind: "admin", sessionId: "sess-1" });
      refresh.findByHash.mockResolvedValue({ revokedAt: null });
    });

    it("rejects a deactivated account", async () => {
      admins.findById.mockResolvedValue(account({ isActive: false }));
      await expect(service.refresh("rt")).rejects.toThrow("Account is inactive");
      expect(refresh.create).not.toHaveBeenCalled();
    });

    it("rejects a banned account with the admin message", async () => {
      admins.findById.mockResolvedValue(account({ isBanned: true }));
      await expect(service.refresh("rt")).rejects.toThrow("Contact your administrator");
    });

    it("rejects a deleted account", async () => {
      admins.findById.mockResolvedValue(null);
      await expect(service.refresh("rt")).rejects.toThrow("Account no longer exists");
    });

    it("revokes everything on refresh-token reuse", async () => {
      refresh.findByHash.mockResolvedValue({ revokedAt: new Date() });
      await expect(service.refresh("rt")).rejects.toThrow("reuse detected");
      expect(refresh.revokeAllForUser).toHaveBeenCalledWith(UID, "admin");
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith(UID, "admin", "refresh-reuse");
    });

    it("rotates the token and session for an active account", async () => {
      admins.findById.mockResolvedValue(account({ role: "admin" }));
      await expect(service.refresh("rt", { deviceId: "d1" })).resolves.toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
      expect(sessions.validateOrRehydrate).toHaveBeenCalledWith(
        "sess-1",
        expect.objectContaining({ userId: UID, userKind: "admin", deviceId: "d1" }),
      );
      expect(refresh.revoke).toHaveBeenCalledWith("hash:rt", "hash:refresh-token");
      expect(sessions.rotateRefresh).toHaveBeenCalledWith(
        "sess-1",
        "hash:refresh-token",
        expect.any(Date),
      );
    });

    it("tolerates a refresh token the DB has no row for (DB wipe)", async () => {
      refresh.findByHash.mockResolvedValue(null);
      verifyRefresh.mockReturnValue({ id: UID, kind: "user" });
      users.findById.mockResolvedValue(account());
      await service.refresh("rt");
      expect(refresh.revoke).not.toHaveBeenCalled();
      expect(sessions.validateOrRehydrate).not.toHaveBeenCalled();
    });

    it("rejects an invalid refresh JWT", async () => {
      verifyRefresh.mockImplementation(() => {
        throw new Error("bad");
      });
      await expect(service.refresh("rt")).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe("logout", () => {
    it("is a no-op without a token or with an invalid one", async () => {
      await service.logout(undefined);
      verifyRefresh.mockImplementation(() => {
        throw new Error("bad");
      });
      await service.logout("junk");
      expect(refresh.revoke).not.toHaveBeenCalled();
    });

    it("revokes the refresh token and the session", async () => {
      verifyRefresh.mockReturnValue({ id: UID, kind: "user", sessionId: "sess-1" });
      await service.logout("rt");
      expect(refresh.revoke).toHaveBeenCalledWith("hash:rt");
      expect(sessions.revoke).toHaveBeenCalledWith("sess-1", "user-logout");
    });
  });

  it("resetPassword rejects an expired OTP", async () => {
    users.findByEmailWithSecrets.mockResolvedValue(
      account({ resetOtp: "hashed:123456", otpExpiry: new Date(Date.now() - 1000) }),
    );
    const err = await service
      .resetPassword({ email: "a@b.com", otp: "123456", newPassword: "newpassword" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.message).toBe("OTP has expired");
  });

  describe("loginCustomerWithGoogle", () => {
    it("logs in an already-linked user", async () => {
      users.findByGoogleId.mockResolvedValue(account());
      await service.loginCustomerWithGoogle(google());
      expect(users.create).not.toHaveBeenCalled();
      expect(users.linkGoogleId).not.toHaveBeenCalled();
    });

    it("links an existing account by lowercased email", async () => {
      users.findByGoogleId.mockResolvedValue(null);
      users.findByEmail.mockResolvedValue(account());
      await service.loginCustomerWithGoogle(google());
      expect(users.findByEmail).toHaveBeenCalledWith("someone@example.com");
      expect(users.linkGoogleId).toHaveBeenCalledWith(UID, "g-sub-1");
    });

    it("creates a new customer when nothing matches", async () => {
      users.findByGoogleId.mockResolvedValue(null);
      users.findByEmail.mockResolvedValue(null);
      users.create.mockResolvedValue(account());
      await service.loginCustomerWithGoogle(google({ name: undefined }));
      expect(users.create).toHaveBeenCalledWith({
        email: "someone@example.com",
        googleId: "g-sub-1",
      });
    });

    it("refuses blocked / inactive customers and non-google providers", async () => {
      users.findByGoogleId.mockResolvedValueOnce(account({ isBanned: true }));
      await expect(service.loginCustomerWithGoogle(google())).rejects.toThrow("blocked");
      users.findByGoogleId.mockResolvedValueOnce(account({ isActive: false }));
      await expect(service.loginCustomerWithGoogle(google())).rejects.toThrow("inactive");
      await expect(
        service.loginCustomerWithGoogle(google({ provider: "github" as never })),
      ).rejects.toThrow("provider=github");
    });
  });

  describe("loginAdminWithGoogle", () => {
    it("links an invited admin by email and logs them in", async () => {
      admins.findByGoogleId.mockResolvedValue(null);
      admins.findByEmail.mockResolvedValue(account({ role: "admin" }));
      await expect(service.loginAdminWithGoogle(google())).resolves.toHaveProperty("accessToken");
      expect(admins.linkGoogleId).toHaveBeenCalledWith(UID, "g-sub-1");
    });

    it("records an unknown email as a blocked admin shell and refuses", async () => {
      admins.findByGoogleId.mockResolvedValue(null);
      admins.findByEmail.mockResolvedValue(null);
      await expect(service.loginAdminWithGoogle(google())).rejects.toBeInstanceOf(ForbiddenError);
      expect(admins.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "someone@example.com",
          googleId: "g-sub-1",
          role: "admin",
          isBanned: true,
          bannedReason: "Unauthorized OAuth attempt on admin portal",
          name: "Some One",
        }),
      );
      expect(sessions.createAndEnforceSingleDevice).not.toHaveBeenCalled();
    });

    it("refuses without persisting a shell when auto-block is off", async () => {
      admins.findByGoogleId.mockResolvedValue(null);
      admins.findByEmail.mockResolvedValue(null);
      await expect(service.loginAdminWithGoogle(google(), {}, false)).rejects.toThrow(
        "not authorized",
      );
      expect(admins.create).not.toHaveBeenCalled();
    });

    it("refuses a blocked or inactive admin and non-google providers", async () => {
      admins.findByGoogleId.mockResolvedValueOnce(account({ isBanned: true }));
      await expect(service.loginAdminWithGoogle(google())).rejects.toThrow("blocked");
      admins.findByGoogleId.mockResolvedValueOnce(account({ isActive: false }));
      await expect(service.loginAdminWithGoogle(google())).rejects.toThrow("inactive");
      await expect(
        service.loginAdminWithGoogle(google({ provider: "github" as never })),
      ).rejects.toThrow("provider=github");
    });
  });

  describe("getCurrentAccount", () => {
    it("resolves an admin with role and optional fields", async () => {
      const last = new Date();
      admins.findById.mockResolvedValue(
        account({ role: "superadmin", name: "Root", phone: "98", lastLoginAt: last }),
      );
      const me = await service.getCurrentAccount(UID, "admin");
      expect(me).toMatchObject({
        id: UID,
        kind: "admin",
        role: "superadmin",
        name: "Root",
        phone: "98",
        lastLoginAt: last,
      });
      expect(me).not.toHaveProperty("password");
    });

    it("resolves a customer without a role; 401 when gone", async () => {
      users.findById.mockResolvedValueOnce(account()).mockResolvedValueOnce(null);
      const me = await service.getCurrentAccount(UID, "user");
      expect(me).not.toHaveProperty("role");
      await expect(service.getCurrentAccount(UID, "user")).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    });
  });
});
