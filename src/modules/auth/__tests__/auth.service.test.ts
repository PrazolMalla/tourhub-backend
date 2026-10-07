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

jest.mock("../../../utils/auth/otp.util", () => ({
  OtpUtil: {
    generateNumericOTP: jest.fn(() => "123456"),
  },
}));

jest.mock("../../../config/emailConfig", () => ({
  __esModule: true,
  default: {
    sendEmail: jest.fn().mockResolvedValue({ messageId: "test" }),
    initializeEmail: jest.fn(),
  },
}));

// AuthService now writes session rows on login + audit rows on every action
// (post user/admin split). Stub both so the tests don't try to hit Mongo and
// time out.
jest.mock("../../session/session.module", () => ({
  SessionModule: {
    service: () => ({
      createAndEnforceSingleDevice: jest.fn().mockResolvedValue({
        sessionId: "sess-test",
        deviceId: "device-test",
      }),
      rotateRefresh: jest.fn().mockResolvedValue(undefined),
      revoke: jest.fn().mockResolvedValue(undefined),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
      validateActive: jest.fn().mockResolvedValue({
        sessionId: "sess-test",
        deviceId: "device-test",
      }),
      touch: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

import bcrypt from "bcryptjs";
import emailConfig from "../../../config/emailConfig";
import jwtService from "../../../utils/auth/jwt.util";
import { AuthService } from "../auth.service";
import type { AuthRepository } from "../auth.repository";
import type { AdminRepository } from "../../admin/admin.repository";
import type { RefreshTokenRepository } from "../refresh-token.repository";
import { ConflictError, HttpError, UnauthorizedError } from "../../../core/errors";

const VALID_OBJECT_ID = "507f1f77bcf86cd799439011";

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => VALID_OBJECT_ID },
  email: "alice@example.com",
  password: "hashed:correct-password",
  resetOtp: null,
  otpExpiry: null,
  // Login refuses non-active / banned accounts (post user/admin split).
  isActive: true,
  isBanned: false,
  ...overrides,
});

const makeAuthRepo = () => ({
  findByEmailWithSecrets: jest.fn(),
  findByEmail: jest.fn(),
  findByGoogleId: jest.fn(),
  linkGoogleId: jest.fn(),
  setOtp: jest.fn(),
  setPassword: jest.fn(),
  updateLastLogin: jest.fn(),
  markBanned: jest.fn(),
  setBanned: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
});

const makeRefreshRepo = () => ({
  findByHash: jest.fn(),
  revoke: jest.fn(),
  revokeAllForUser: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
});

// Minimal AdminRepository mock — the customer-side tests in this file never
// exercise admin code paths, but AuthService now takes an admin repo as a
// constructor arg (the user/admin split). See qa-test.md fix batch.
const makeAdminRepo = () => ({
  findByEmail: jest.fn(),
  findByGoogleId: jest.fn(),
  linkGoogleId: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
});

describe("AuthService", () => {
  let authRepo: ReturnType<typeof makeAuthRepo>;
  let adminRepo: ReturnType<typeof makeAdminRepo>;
  let refreshRepo: ReturnType<typeof makeRefreshRepo>;
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authRepo = makeAuthRepo();
    adminRepo = makeAdminRepo();
    refreshRepo = makeRefreshRepo();
    service = new AuthService(
      authRepo as unknown as AuthRepository,
      adminRepo as unknown as AdminRepository,
      refreshRepo as unknown as RefreshTokenRepository,
    );
  });

  describe("register", () => {
    it("hashes password, persists user, stores refresh token, returns token pair", async () => {
      authRepo.findByEmailWithSecrets.mockResolvedValue(null);
      authRepo.create.mockResolvedValue(makeUser());

      const result = await service.register({
        email: "alice@example.com",
        password: "supersecret",
      });

      expect(bcrypt.hash).toHaveBeenCalled();
      expect(authRepo.create).toHaveBeenCalledWith({
        email: "alice@example.com",
        password: "hashed:supersecret",
      });
      expect(refreshRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tokenHash: "hash:refresh-token" }),
      );
      expect(result).toEqual({ accessToken: "access-token", refreshToken: "refresh-token" });
    });

    it("throws ConflictError when email already exists", async () => {
      authRepo.findByEmailWithSecrets.mockResolvedValue(makeUser());
      await expect(
        service.register({ email: "alice@example.com", password: "supersecret" }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("includes optional name when provided", async () => {
      authRepo.findByEmailWithSecrets.mockResolvedValue(null);
      authRepo.create.mockResolvedValue(makeUser());

      await service.register({
        email: "alice@example.com",
        password: "supersecret",
        name: "Alice",
      });

      expect(authRepo.create).toHaveBeenCalledWith({
        email: "alice@example.com",
        password: "hashed:supersecret",
        name: "Alice",
      });
    });
  });

  describe("login", () => {
    it("returns token pair on valid credentials", async () => {
      authRepo.findByEmailWithSecrets.mockResolvedValue(makeUser());
      const result = await service.login({
        email: "alice@example.com",
        password: "correct-password",
      });
      expect(result).toEqual({ accessToken: "access-token", refreshToken: "refresh-token" });
      expect(refreshRepo.create).toHaveBeenCalled();
    });

    it("throws UnauthorizedError when user is missing", async () => {
      authRepo.findByEmailWithSecrets.mockResolvedValue(null);
      await expect(
        service.login({ email: "alice@example.com", password: "anything" }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("throws UnauthorizedError on bad password", async () => {
      authRepo.findByEmailWithSecrets.mockResolvedValue(makeUser());
      await expect(
        service.login({ email: "alice@example.com", password: "wrong-password" }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("throws UnauthorizedError when user has no password set", async () => {
      authRepo.findByEmailWithSecrets.mockResolvedValue(makeUser({ password: undefined }));
      await expect(
        service.login({ email: "alice@example.com", password: "anything" }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe("refresh", () => {
    it("issues new pair and revokes the old token on rotation", async () => {
      jest
        .mocked(jwtService.verifyRefreshToken)
        .mockReturnValue({ id: VALID_OBJECT_ID, kind: "user" });
      refreshRepo.findByHash.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      authRepo.findById.mockResolvedValue(makeUser());

      const result = await service.refresh("old-refresh");

      expect(refreshRepo.revoke).toHaveBeenCalledWith("hash:old-refresh", "hash:refresh-token");
      expect(result).toEqual({ accessToken: "access-token", refreshToken: "refresh-token" });
    });

    it("throws UnauthorizedError when refresh token signature is invalid", async () => {
      jest.mocked(jwtService.verifyRefreshToken).mockImplementation(() => {
        throw new Error("bad sig");
      });
      await expect(service.refresh("bogus")).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("throws UnauthorizedError when token isn't recognised in storage", async () => {
      jest
        .mocked(jwtService.verifyRefreshToken)
        .mockReturnValue({ id: VALID_OBJECT_ID, kind: "user" });
      refreshRepo.findByHash.mockResolvedValue(null);
      await expect(service.refresh("unknown")).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("on reuse of a revoked token, revokes ALL of the user's tokens", async () => {
      jest
        .mocked(jwtService.verifyRefreshToken)
        .mockReturnValue({ id: VALID_OBJECT_ID, kind: "user" });
      refreshRepo.findByHash.mockResolvedValue({
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      await expect(service.refresh("revoked")).rejects.toBeInstanceOf(UnauthorizedError);
      expect(refreshRepo.revokeAllForUser).toHaveBeenCalledWith(VALID_OBJECT_ID, "user");
    });

    it("throws UnauthorizedError when stored token has expired", async () => {
      jest
        .mocked(jwtService.verifyRefreshToken)
        .mockReturnValue({ id: VALID_OBJECT_ID, kind: "user" });
      refreshRepo.findByHash.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh("expired")).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("throws UnauthorizedError when user has been deleted", async () => {
      jest
        .mocked(jwtService.verifyRefreshToken)
        .mockReturnValue({ id: VALID_OBJECT_ID, kind: "user" });
      refreshRepo.findByHash.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      authRepo.findById.mockResolvedValue(null);
      await expect(service.refresh("orphan")).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe("logout", () => {
    it("no-ops when given undefined token", async () => {
      await service.logout(undefined);
      expect(refreshRepo.revoke).not.toHaveBeenCalled();
    });

    it("no-ops when token signature is invalid", async () => {
      jest.mocked(jwtService.verifyRefreshToken).mockImplementation(() => {
        throw new Error("bad sig");
      });
      await service.logout("bogus");
      expect(refreshRepo.revoke).not.toHaveBeenCalled();
    });

    it("revokes the stored token when valid", async () => {
      jest
        .mocked(jwtService.verifyRefreshToken)
        .mockReturnValue({ id: VALID_OBJECT_ID, kind: "user" });
      await service.logout("valid-token");
      expect(refreshRepo.revoke).toHaveBeenCalledWith("hash:valid-token");
    });
  });

  describe("forgetPassword", () => {
    it("silently returns when user not found (enumeration resistance)", async () => {
      authRepo.findByEmailWithSecrets.mockResolvedValue(null);
      await expect(service.forgetPassword({ email: "ghost@example.com" })).resolves.toBeUndefined();
      expect(emailConfig.sendEmail).not.toHaveBeenCalled();
      expect(authRepo.setOtp).not.toHaveBeenCalled();
    });

    it("hashes OTP, persists it, and sends an email when found", async () => {
      authRepo.findByEmailWithSecrets.mockResolvedValue(makeUser());
      await service.forgetPassword({ email: "alice@example.com" });

      expect(authRepo.setOtp).toHaveBeenCalledWith(
        VALID_OBJECT_ID,
        "hashed:123456",
        expect.any(Date),
      );
      expect(emailConfig.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "alice@example.com",
          template: "otp",
          data: { otp: "123456" },
        }),
      );
    });
  });

  describe("resetPassword", () => {
    it("rejects when user has no pending OTP", async () => {
      authRepo.findByEmailWithSecrets.mockResolvedValue(makeUser());
      await expect(
        service.resetPassword({
          email: "alice@example.com",
          otp: "123456",
          newPassword: "newsecret123",
        }),
      ).rejects.toBeInstanceOf(HttpError);
    });

    it("rejects expired OTP", async () => {
      authRepo.findByEmailWithSecrets.mockResolvedValue(
        makeUser({
          resetOtp: "hashed:123456",
          otpExpiry: new Date(Date.now() - 1000),
        }),
      );
      await expect(
        service.resetPassword({
          email: "alice@example.com",
          otp: "123456",
          newPassword: "newsecret123",
        }),
      ).rejects.toBeInstanceOf(HttpError);
    });

    it("rejects wrong OTP", async () => {
      authRepo.findByEmailWithSecrets.mockResolvedValue(
        makeUser({
          resetOtp: "hashed:123456",
          otpExpiry: new Date(Date.now() + 60_000),
        }),
      );
      await expect(
        service.resetPassword({
          email: "alice@example.com",
          otp: "999999",
          newPassword: "newsecret123",
        }),
      ).rejects.toBeInstanceOf(HttpError);
    });

    it("hashes new password, persists it, and revokes refresh tokens on success", async () => {
      authRepo.findByEmailWithSecrets.mockResolvedValue(
        makeUser({
          resetOtp: "hashed:123456",
          otpExpiry: new Date(Date.now() + 60_000),
        }),
      );
      await service.resetPassword({
        email: "alice@example.com",
        otp: "123456",
        newPassword: "newsecret123",
      });
      expect(authRepo.setPassword).toHaveBeenCalledWith(VALID_OBJECT_ID, "hashed:newsecret123");
      expect(refreshRepo.revokeAllForUser).toHaveBeenCalledWith(VALID_OBJECT_ID, "user");
    });
  });

  describe("resendOtp", () => {
    it("delegates to forgetPassword", async () => {
      authRepo.findByEmailWithSecrets.mockResolvedValue(null);
      await service.resendOtp({ email: "alice@example.com" });
      expect(authRepo.findByEmailWithSecrets).toHaveBeenCalledWith("alice@example.com");
    });
  });
});
