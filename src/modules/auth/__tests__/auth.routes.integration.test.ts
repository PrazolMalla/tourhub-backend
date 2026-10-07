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
  OtpUtil: { generateNumericOTP: jest.fn(() => "123456") },
}));

jest.mock("../../../config/emailConfig", () => ({
  __esModule: true,
  default: {
    sendEmail: jest.fn().mockResolvedValue({ messageId: "test" }),
    initializeEmail: jest.fn(),
  },
}));

jest.mock("../../../core/middlewares/rate-limit.middleware", () => {
  const passthrough = (_req: unknown, _res: unknown, next: () => void) => next();
  return {
    RateLimitMiddleware: {
      create: () => passthrough,
      global: () => passthrough,
      auth: () => passthrough,
      publicSubmit: () => passthrough,
      publicApi: () => passthrough,
      money: () => passthrough,
    },
  };
});

// AuthService writes session rows on login + audit rows. Stub both so the
// integration tests don't try to hit Mongo and time out.
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

import request from "supertest";
import { Router } from "express";
import jwtService from "../../../utils/auth/jwt.util";
import { App } from "../../../app";
import { AuthController } from "../auth.controller";
import { AuthRoutes } from "../auth.routes";
import { AuthService } from "../auth.service";
import type { AuthRepository } from "../auth.repository";
import type { AdminRepository } from "../../admin/admin.repository";
import type { RefreshTokenRepository } from "../refresh-token.repository";

type AuthRepoMock = Record<keyof AuthRepository, jest.Mock>;
type AdminRepoMock = Record<keyof AdminRepository, jest.Mock>;
type RefreshRepoMock = Record<keyof RefreshTokenRepository, jest.Mock>;

const VALID_OBJECT_ID = "507f1f77bcf86cd799439011";

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => VALID_OBJECT_ID },
  email: "alice@example.com",
  password: "hashed:correct-password",
  resetOtp: null,
  otpExpiry: null,
  // The customer login flow now refuses non-active / banned accounts (these
  // fields were added when the user/admin split shipped).
  isActive: true,
  isBanned: false,
  ...overrides,
});

const makeAuthRepo = (overrides: Partial<AuthRepoMock> = {}): AuthRepoMock => ({
  findByEmailWithSecrets: jest.fn(),
  findByEmail: jest.fn(),
  findByGoogleId: jest.fn(),
  linkGoogleId: jest.fn(),
  setOtp: jest.fn(),
  setPassword: jest.fn(),
  updateLastLogin: jest.fn(),
  markBanned: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  ...overrides,
});

// Admin-side flows aren't covered in this customer-focused integration test
// but the AuthService constructor requires an AdminRepository — pass a no-op.
// Must mirror every method on the real repo (otherwise the
// `Record<keyof AdminRepository, jest.Mock>` shape complains).
const makeAdminRepo = (overrides: Partial<AdminRepoMock> = {}): AdminRepoMock => ({
  findByEmailWithSecrets: jest.fn(),
  findByEmail: jest.fn(),
  findByGoogleId: jest.fn(),
  linkGoogleId: jest.fn(),
  setOtp: jest.fn(),
  setPassword: jest.fn(),
  updateLastLogin: jest.fn(),
  setBanned: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  ...overrides,
});

const makeRefreshRepo = (overrides: Partial<RefreshRepoMock> = {}): RefreshRepoMock => ({
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
  ...overrides,
});

const makeApp = (
  auth: AuthRepoMock,
  refresh: RefreshRepoMock,
  admin: AdminRepoMock = makeAdminRepo(),
) => {
  const service = new AuthService(
    auth as unknown as AuthRepository,
    admin as unknown as AdminRepository,
    refresh as unknown as RefreshTokenRepository,
  );
  const controller = new AuthController(service);
  const authRouter = new AuthRoutes(controller).getRouter();
  const apiRouter = Router();
  apiRouter.use("/auth", authRouter);
  return new App(apiRouter).express;
};

describe("Auth routes (integration)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/auth/register", () => {
    it("201 + sets both access and refresh cookies", async () => {
      const auth = makeAuthRepo({
        findByEmailWithSecrets: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(makeUser()),
      });
      const res = await request(makeApp(auth, makeRefreshRepo()))
        .post("/api/v1/auth/register")
        .send({ email: "new@example.com", password: "supersecret" });
      expect(res.status).toBe(201);
      const cookies = (res.headers["set-cookie"] ?? []) as string[];
      expect(cookies.some((c: string) => c.startsWith("access_token="))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith("refresh_token="))).toBe(true);
    });

    it("409 when email already exists", async () => {
      const auth = makeAuthRepo({
        findByEmailWithSecrets: jest.fn().mockResolvedValue(makeUser()),
      });
      const res = await request(makeApp(auth, makeRefreshRepo()))
        .post("/api/v1/auth/register")
        .send({ email: "alice@example.com", password: "supersecret" });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
    });

    it("422 on invalid body", async () => {
      const res = await request(makeApp(makeAuthRepo(), makeRefreshRepo()))
        .post("/api/v1/auth/register")
        .send({ email: "not-an-email", password: "x" });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("422 on unknown fields (strict)", async () => {
      const res = await request(makeApp(makeAuthRepo(), makeRefreshRepo()))
        .post("/api/v1/auth/register")
        .send({ email: "new@example.com", password: "supersecret", admin: true });
      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("200 + sets both cookies on valid credentials", async () => {
      const auth = makeAuthRepo({
        findByEmailWithSecrets: jest.fn().mockResolvedValue(makeUser()),
      });
      const res = await request(makeApp(auth, makeRefreshRepo()))
        .post("/api/v1/auth/login")
        .send({ email: "alice@example.com", password: "correct-password" });
      expect(res.status).toBe(200);
      const cookies = (res.headers["set-cookie"] ?? []) as string[];
      expect(cookies.some((c: string) => c.startsWith("access_token="))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith("refresh_token="))).toBe(true);
    });

    it("401 on wrong password", async () => {
      const auth = makeAuthRepo({
        findByEmailWithSecrets: jest.fn().mockResolvedValue(makeUser()),
      });
      const res = await request(makeApp(auth, makeRefreshRepo()))
        .post("/api/v1/auth/login")
        .send({ email: "alice@example.com", password: "wrong-password" });
      expect(res.status).toBe(401);
    });

    it("401 when user does not exist", async () => {
      const auth = makeAuthRepo({
        findByEmailWithSecrets: jest.fn().mockResolvedValue(null),
      });
      const res = await request(makeApp(auth, makeRefreshRepo()))
        .post("/api/v1/auth/login")
        .send({ email: "ghost@example.com", password: "anything-here" });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("401 when refresh cookie is missing", async () => {
      const res = await request(makeApp(makeAuthRepo(), makeRefreshRepo())).post(
        "/api/v1/auth/refresh",
      );
      expect(res.status).toBe(401);
    });

    it("200 + rotates cookies on valid refresh", async () => {
      jest
        .mocked(jwtService.verifyRefreshToken)
        .mockReturnValue({ id: VALID_OBJECT_ID, kind: "user" });
      const refresh = makeRefreshRepo({
        findByHash: jest.fn().mockResolvedValue({
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      });
      const auth = makeAuthRepo({
        findById: jest.fn().mockResolvedValue(makeUser()),
      });
      const res = await request(makeApp(auth, refresh))
        .post("/api/v1/auth/refresh")
        .set("Cookie", "refresh_token=old-refresh");
      expect(res.status).toBe(200);
      expect(refresh.revoke).toHaveBeenCalledWith("hash:old-refresh", "hash:refresh-token");
    });

    it("401 on reuse of a revoked token + revokes the user's chain", async () => {
      jest
        .mocked(jwtService.verifyRefreshToken)
        .mockReturnValue({ id: VALID_OBJECT_ID, kind: "user" });
      const refresh = makeRefreshRepo({
        findByHash: jest.fn().mockResolvedValue({
          revokedAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
        }),
      });
      const res = await request(makeApp(makeAuthRepo(), refresh))
        .post("/api/v1/auth/refresh")
        .set("Cookie", "refresh_token=revoked-token");
      expect(res.status).toBe(401);
      expect(refresh.revokeAllForUser).toHaveBeenCalledWith(VALID_OBJECT_ID, "user");
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("200 + clears both cookies", async () => {
      const res = await request(makeApp(makeAuthRepo(), makeRefreshRepo())).post(
        "/api/v1/auth/logout",
      );
      expect(res.status).toBe(200);
      const cookies = (res.headers["set-cookie"] ?? []) as string[];
      expect(cookies.some((c: string) => c.startsWith("access_token=;"))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith("refresh_token=;"))).toBe(true);
    });

    it("revokes the refresh token in storage when one is present", async () => {
      jest
        .mocked(jwtService.verifyRefreshToken)
        .mockReturnValue({ id: VALID_OBJECT_ID, kind: "user" });
      const refresh = makeRefreshRepo();
      await request(makeApp(makeAuthRepo(), refresh))
        .post("/api/v1/auth/logout")
        .set("Cookie", "refresh_token=alive");
      expect(refresh.revoke).toHaveBeenCalledWith("hash:alive");
    });
  });

  describe("POST /api/v1/auth/forget-password", () => {
    it("200 + silent when email not registered", async () => {
      const auth = makeAuthRepo({
        findByEmailWithSecrets: jest.fn().mockResolvedValue(null),
      });
      const res = await request(makeApp(auth, makeRefreshRepo()))
        .post("/api/v1/auth/forget-password")
        .send({ email: "ghost@example.com" });
      expect(res.status).toBe(200);
      expect(auth.setOtp).not.toHaveBeenCalled();
    });

    it("200 + persists OTP and dispatches email when registered", async () => {
      const auth = makeAuthRepo({
        findByEmailWithSecrets: jest.fn().mockResolvedValue(makeUser()),
      });
      const res = await request(makeApp(auth, makeRefreshRepo()))
        .post("/api/v1/auth/forget-password")
        .send({ email: "alice@example.com" });
      expect(res.status).toBe(200);
      expect(auth.setOtp).toHaveBeenCalled();
    });
  });

  describe("POST /api/v1/auth/reset-password", () => {
    it("400 on invalid OTP", async () => {
      const auth = makeAuthRepo({
        findByEmailWithSecrets: jest.fn().mockResolvedValue(
          makeUser({
            resetOtp: "hashed:123456",
            otpExpiry: new Date(Date.now() + 60_000),
          }),
        ),
      });
      const res = await request(makeApp(auth, makeRefreshRepo()))
        .post("/api/v1/auth/reset-password")
        .send({
          email: "alice@example.com",
          otp: "999999",
          newPassword: "newsecret123",
        });
      expect(res.status).toBe(400);
    });

    it("200 on valid OTP and revokes refresh tokens", async () => {
      const auth = makeAuthRepo({
        findByEmailWithSecrets: jest.fn().mockResolvedValue(
          makeUser({
            resetOtp: "hashed:123456",
            otpExpiry: new Date(Date.now() + 60_000),
          }),
        ),
      });
      const refresh = makeRefreshRepo();
      const res = await request(makeApp(auth, refresh)).post("/api/v1/auth/reset-password").send({
        email: "alice@example.com",
        otp: "123456",
        newPassword: "newsecret123",
      });
      expect(res.status).toBe(200);
      expect(auth.setPassword).toHaveBeenCalled();
      expect(refresh.revokeAllForUser).toHaveBeenCalledWith(VALID_OBJECT_ID, "user");
    });

    it("422 when OTP length invalid", async () => {
      const res = await request(makeApp(makeAuthRepo(), makeRefreshRepo()))
        .post("/api/v1/auth/reset-password")
        .send({
          email: "alice@example.com",
          otp: "12",
          newPassword: "newsecret123",
        });
      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/v1/auth/resend-otp", () => {
    it("200 silent regardless of email registration", async () => {
      const auth = makeAuthRepo({
        findByEmailWithSecrets: jest.fn().mockResolvedValue(null),
      });
      const res = await request(makeApp(auth, makeRefreshRepo()))
        .post("/api/v1/auth/resend-otp")
        .send({ email: "ghost@example.com" });
      expect(res.status).toBe(200);
    });
  });
});
