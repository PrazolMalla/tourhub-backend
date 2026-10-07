jest.mock("../../../../core/middlewares/rate-limit.middleware", () => {
  const passthrough = (_req: unknown, _res: unknown, next: () => void) => next();
  return {
    RateLimitMiddleware: {
      create: () => passthrough,
      global: () => passthrough,
      auth: () => passthrough,
      publicSubmit: () => passthrough,
      publicApi: () => passthrough,
    },
  };
});

import request from "supertest";
import { Router } from "express";
import { App } from "../../../../app";
import { GoogleOAuthController } from "../google.controller";
import { GoogleOAuthRoutes } from "../google.routes";
import { GoogleOAuthService } from "../google.service";
import type { AuthService } from "../../auth.service";
import type { AuthTokens } from "../../auth.types";
import { OAUTH_STATE_COOKIE_NAME, issueOAuthState } from "../oauth-state.util";

const STATE_SECRET = "s".repeat(32);
const SUCCESS_URL = "http://localhost:5173/auth/success";
const FAILURE_URL = "http://localhost:5173/auth/error";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const ok = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });

const fail = (status: number, body: string) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
  });

const stubAuthService = (tokens?: AuthTokens): AuthService =>
  ({
    // This integration test exercises the kind="user" branch of GoogleOAuthController,
    // which calls `loginCustomerWithGoogle` (renamed from the pre-split
    // `loginWithGoogle`).
    loginCustomerWithGoogle: jest
      .fn()
      .mockResolvedValue(
        tokens ?? { accessToken: "access.jwt.token", refreshToken: "refresh.jwt.token" },
      ),
    loginAdminWithGoogle: jest.fn(),
  }) as unknown as AuthService;

const makeApp = (auth: AuthService) => {
  const googleService = new GoogleOAuthService("cid", "csecret", "http://localhost:3000/cb");
  const controller = new GoogleOAuthController(googleService, auth, {
    kind: "user",
    stateSecret: STATE_SECRET,
    successUrl: SUCCESS_URL,
    failureUrl: FAILURE_URL,
  });
  const router = Router();
  router.use("/auth/google", new GoogleOAuthRoutes(controller).getRouter());
  return new App(router).express;
};

describe("Google OAuth routes (integration)", () => {
  beforeEach(() => mockFetch.mockReset());

  describe("GET /api/v1/auth/google", () => {
    it("302 redirects to Google with state cookie set", async () => {
      const res = await request(makeApp(stubAuthService())).get("/api/v1/auth/google");
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(res.headers.location).toContain("state=");
      const cookies = (res.headers["set-cookie"] ?? []) as string[];
      expect(cookies.some((c) => c.startsWith(`${OAUTH_STATE_COOKIE_NAME}=`))).toBe(true);
    });
  });

  describe("GET /api/v1/auth/google/callback", () => {
    it("redirects to failure URL when state is missing", async () => {
      const res = await request(makeApp(stubAuthService())).get("/api/v1/auth/google/callback");
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(FAILURE_URL);
      expect(res.headers.location).toContain("error=missing_params");
    });

    it("redirects to failure URL when state cookie doesn't match", async () => {
      const { state } = issueOAuthState(STATE_SECRET);
      const res = await request(makeApp(stubAuthService()))
        .get(`/api/v1/auth/google/callback?code=c&state=${state}`)
        .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=wrong-cookie.value`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain("error=state_mismatch");
    });

    it("redirects to failure URL when provider sent ?error", async () => {
      const res = await request(makeApp(stubAuthService())).get(
        "/api/v1/auth/google/callback?error=access_denied",
      );
      expect(res.headers.location).toContain("error=provider_denied");
    });

    it("redirects to failure URL when code exchange fails", async () => {
      mockFetch.mockReturnValueOnce(fail(400, "invalid_grant"));
      const { state, cookie } = issueOAuthState(STATE_SECRET);
      const res = await request(makeApp(stubAuthService()))
        .get(`/api/v1/auth/google/callback?code=c&state=${state}`)
        .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${cookie}`);
      expect(res.headers.location).toContain("error=code_exchange_failed");
    });

    it("redirects to failure URL when profile fetch fails", async () => {
      mockFetch
        .mockReturnValueOnce(ok({ access_token: "ya29.x" }))
        .mockReturnValueOnce(fail(401, "expired"));
      const { state, cookie } = issueOAuthState(STATE_SECRET);
      const res = await request(makeApp(stubAuthService()))
        .get(`/api/v1/auth/google/callback?code=c&state=${state}`)
        .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${cookie}`);
      expect(res.headers.location).toContain("error=profile_fetch_failed");
    });

    it("on success: sets access+refresh cookies and redirects to success URL", async () => {
      mockFetch
        .mockReturnValueOnce(ok({ access_token: "ya29.x" }))
        .mockReturnValueOnce(
          ok({ sub: "1098", email: "alice@example.com", email_verified: true, name: "Alice" }),
        );
      const { state, cookie } = issueOAuthState(STATE_SECRET);
      const auth = stubAuthService();
      const res = await request(makeApp(auth))
        .get(`/api/v1/auth/google/callback?code=c&state=${state}`)
        .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${cookie}`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(SUCCESS_URL);
      const cookies = (res.headers["set-cookie"] ?? []) as string[];
      expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true);
      expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
      expect(auth.loginCustomerWithGoogle).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "google",
          providerId: "1098",
          email: "alice@example.com",
        }),
        expect.anything(), // login context (ip / userAgent / deviceId)
      );
    });
  });
});
