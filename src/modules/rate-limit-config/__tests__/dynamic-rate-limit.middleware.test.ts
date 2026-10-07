import express from "express";
import request from "supertest";
import type { DynamicRateLimitMiddleware as DRL } from "../dynamic-rate-limit.middleware";

const load = (env: { NODE_ENV: string; DISABLE_RATE_LIMITS: boolean }): typeof DRL => {
  let mod: { DynamicRateLimitMiddleware: typeof DRL } | undefined;
  jest.isolateModules(() => {
    jest.doMock("../../../config/env", () => ({ env }));
    jest.doMock("../../../constants", () => ({
      AppConstants: {
        RATE_LIMIT_GLOBAL_WINDOW_MS: 60_000,
        RATE_LIMIT_GLOBAL_MAX: 5,
        RATE_LIMIT_AUTH_WINDOW_MS: 60_000,
        RATE_LIMIT_AUTH_MAX: 5,
        RATE_LIMIT_PUBLIC_API_WINDOW_MS: 60_000,
        RATE_LIMIT_PUBLIC_API_MAX: 5,
        RATE_LIMIT_PUBLIC_SUBMIT_WINDOW_MS: 60_000,
        RATE_LIMIT_PUBLIC_SUBMIT_MAX: 2,
      },
    }));
    // reason: isolateModules needs a synchronous re-import after jest.doMock.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("../dynamic-rate-limit.middleware");
  });
  return mod!.DynamicRateLimitMiddleware;
};

const appWith = (handler: express.RequestHandler) => {
  const app = express();
  app.post("/", handler, (_req, res) => {
    res.status(201).json({ ok: true });
  });
  return app;
};

describe("DynamicRateLimitMiddleware", () => {
  afterEach(() => jest.resetModules());

  it.each(["development", "test", "staging"])(
    "is a pass-through when NODE_ENV=%s",
    async (NODE_ENV) => {
      const M = load({ NODE_ENV, DISABLE_RATE_LIMITS: false });
      const app = appWith(M.for("enquiry"));
      for (let i = 0; i < 5; i++) expect((await request(app).post("/")).status).toBe(201);
    },
  );

  it("is a pass-through in production when DISABLE_RATE_LIMITS=true", async () => {
    const M = load({ NODE_ENV: "production", DISABLE_RATE_LIMITS: true });
    const app = appWith(M.for("enquiry"));
    for (let i = 0; i < 5; i++) expect((await request(app).post("/")).status).toBe(201);
  });

  describe("production", () => {
    it("returns 429 with the scope message once the limit is hit", async () => {
      const M = load({ NODE_ENV: "production", DISABLE_RATE_LIMITS: false });
      const app = appWith(M.for("enquiry"));
      expect((await request(app).post("/")).status).toBe(201);
      expect((await request(app).post("/")).status).toBe(201);
      const res = await request(app).post("/");
      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Submission limit exceeded, please try again later.",
        },
      });
      expect(res.headers["ratelimit-policy"]).toBeDefined();
      expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
    });

    it("reuses one handler per scope so counters are shared across routes", () => {
      const M = load({ NODE_ENV: "production", DISABLE_RATE_LIMITS: false });
      expect(M.for("auth")).toBe(M.for("auth"));
      expect(M.for("auth")).not.toBe(M.for("enquiry"));
    });

    it.each(["global", "auth", "trip", "admin"] as const)("builds a limiter for %s", (scope) => {
      const M = load({ NODE_ENV: "production", DISABLE_RATE_LIMITS: false });
      expect(typeof M.for(scope)).toBe("function");
    });
  });
});
