import crypto from "crypto";
import express, { type Request, type RequestHandler } from "express";
import request from "supertest";
import { getClientIp } from "../client-ip.util";
import { AttachDeviceMiddleware, VerifyDeviceMiddleware } from "../device.middleware";
import { HmacMiddleware } from "../hmac.middleware";
import { HoneypotMiddleware, IpAbuseMiddleware } from "../public-protection.middleware";
import { ForbiddenError, UnauthorizedError } from "../../../core/errors";
import { env } from "../../../config/env";

/** Minimal app mirroring the real `trust proxy` setting (see app.ts). */
const appWith = (...handlers: RequestHandler[]) => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.all("/{*any}", ...handlers, (req, res) => {
    res.json({ ip: getClientIp(req), device: req.deviceInfo ?? null, body: req.body ?? null });
  });
  app.use(((err, _req, res, _next) => {
    res.status(err.statusCode ?? 500).json({ error: err.message });
  }) as express.ErrorRequestHandler);
  return app;
};

describe("getClientIp", () => {
  it("uses req.ip", () => {
    expect(getClientIp({ ip: "9.9.9.9", socket: {} } as unknown as Request)).toBe("9.9.9.9");
  });

  it("falls back to the socket address, then 'unknown'", () => {
    expect(getClientIp({ socket: { remoteAddress: "8.8.8.8" } } as unknown as Request)).toBe(
      "8.8.8.8",
    );
    expect(getClientIp({ socket: {} } as unknown as Request)).toBe("unknown");
  });

  it("cannot be spoofed with a client-supplied X-Forwarded-For chain", async () => {
    // With `trust proxy 1`, only the hop appended by our proxy (the last one) counts.
    const res = await request(appWith()).get("/").set("X-Forwarded-For", "6.6.6.6, 203.0.113.7");
    expect(res.body.ip).toBe("203.0.113.7");
  });
});

describe("AttachDeviceMiddleware", () => {
  const attach = new AttachDeviceMiddleware().handle;

  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Chrome",
      "Windows",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      "Safari",
      "macOS",
    ],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0", "Firefox", "Linux"],
    [
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
      "Chrome",
      "Android",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "Safari",
      "iOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0",
      "Edge",
      "Windows",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 OPR/111.0",
      "Opera",
      "Windows",
    ],
    ["curl/8.0", "Unknown", "Unknown"],
  ])("parses %s", async (ua, browser, os) => {
    const res = await request(appWith(attach)).get("/").set("User-Agent", ua);
    expect(res.body.device).toMatchObject({ browser, os, userAgent: ua });
  });

  it("derives a stable 40-char deviceId from x-device-id + UA", async () => {
    const app = appWith(attach);
    const a = await request(app).get("/").set("x-device-id", "dev-1").set("User-Agent", "UA");
    const b = await request(app).get("/").set("x-device-id", "dev-1").set("User-Agent", "UA");
    const c = await request(app).get("/").set("x-device-id", "dev-2").set("User-Agent", "UA");
    const expected = crypto.createHash("sha256").update("dev-1::UA").digest("hex").slice(0, 40);
    expect(a.body.device.deviceId).toBe(expected);
    expect(b.body.device.deviceId).toBe(expected);
    expect(c.body.device.deviceId).not.toBe(expected);
  });

  it("falls back to a UA+IP fingerprint without x-device-id", async () => {
    const res = await request(appWith(attach)).get("/").set("User-Agent", "UA");
    expect(res.body.device.deviceId).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe("VerifyDeviceMiddleware", () => {
  it("401 without deviceInfo, passes with it", async () => {
    const verify = new VerifyDeviceMiddleware().handle;
    expect((await request(appWith(verify)).get("/")).status).toBe(401);
    const attach = new AttachDeviceMiddleware().handle;
    expect((await request(appWith(attach, verify)).get("/")).status).toBe(200);
  });
});

describe("HmacMiddleware", () => {
  const secret = "s3cret";
  const apiKey = "key-123";
  const mw = new HmacMiddleware({ secret, apiKey, toleranceMs: 60_000 });
  const sign = (payload: string) =>
    crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const run = (
    headers: Record<string, string | undefined>,
    opts: { method?: string; url?: string; body?: unknown } = {},
  ) =>
    new Promise<unknown>((resolve) => {
      const req = {
        headers: { "content-type": "application/json", ...headers },
        method: opts.method ?? "POST",
        originalUrl: opts.url ?? "/api/v1/x?a=1",
        body: opts.body,
      } as unknown as Request;
      mw.handle(req, {} as never, (err?: unknown) => resolve(err));
    });

  const now = () => String(Date.now());

  it("accepts a correctly signed JSON POST", async () => {
    const ts = now();
    const body = { a: 1 };
    const err = await run(
      {
        "x-api-key": apiKey,
        "x-request-timestamp": ts,
        "x-signature": sign(`${ts}/api/v1/x${JSON.stringify(body)}`),
      },
      { body },
    );
    expect(err).toBeUndefined();
  });

  it("signs GET/DELETE over path + query", async () => {
    const ts = now();
    const err = await run(
      { "x-api-key": apiKey, "x-request-timestamp": ts, "x-signature": sign(`${ts}/api/v1/x?a=1`) },
      { method: "GET" },
    );
    expect(err).toBeUndefined();
  });

  it("signs multipart without the body", async () => {
    const ts = now();
    const err = await run({
      "x-api-key": apiKey,
      "x-request-timestamp": ts,
      "content-type": "multipart/form-data; boundary=x",
      "x-signature": sign(`${ts}/api/v1/x`),
    });
    expect(err).toBeUndefined();
  });

  it.each([
    ["missing api key", { "x-api-key": undefined }],
    ["wrong api key", { "x-api-key": "nope" }],
    ["missing timestamp", { "x-request-timestamp": undefined }],
    ["non-numeric timestamp", { "x-request-timestamp": "abc" }],
    ["stale timestamp", { "x-request-timestamp": String(Date.now() - 120_000) }],
    ["missing signature", { "x-signature": undefined }],
    ["wrong signature", { "x-signature": "0".repeat(64) }],
    ["short signature", { "x-signature": "abc" }],
    ["multi-byte signature of equal length", { "x-signature": "é".repeat(64) }],
  ])("401 for %s", async (_label, override) => {
    const ts = now();
    const headers: Record<string, string | undefined> = {
      "x-api-key": apiKey,
      "x-request-timestamp": ts,
      "x-signature": sign(`${ts}/api/v1x`),
      ...override,
    };
    const err = await run(headers, { body: {} });
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  describe("fromEnv", () => {
    const mutableEnv = env as unknown as Record<string, unknown>;
    const saved = { HMAC_SECRET: env.HMAC_SECRET, API_KEY: env.API_KEY };
    const setEnv = (v: Record<string, unknown>) => Object.assign(mutableEnv, v);

    afterEach(() => setEnv(saved));

    it("requires HMAC_SECRET and API_KEY", () => {
      setEnv({ HMAC_SECRET: undefined, API_KEY: "k" });
      expect(() => HmacMiddleware.fromEnv()).toThrow("HMAC_SECRET");
      setEnv({ HMAC_SECRET: "s", API_KEY: undefined });
      expect(() => HmacMiddleware.fromEnv()).toThrow("API_KEY");
    });

    it("builds an instance when configured", () => {
      setEnv({ HMAC_SECRET: "s", API_KEY: "k" });
      expect(HmacMiddleware.fromEnv()).toBeInstanceOf(HmacMiddleware);
    });
  });
});

describe("HoneypotMiddleware", () => {
  const hp = new HoneypotMiddleware().handle;

  it("fakes success for bots that fill the hidden field", async () => {
    const res = await request(appWith(hp)).post("/").send({ name: "x", _hp_field: "spam" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data.id).toMatch(/^honeypot-/);
    expect(res.body).not.toHaveProperty("body");
  });

  it("strips an empty honeypot field and continues", async () => {
    const res = await request(appWith(hp)).post("/").send({ name: "x", _hp_field: "  " });
    expect(res.body.body).toEqual({ name: "x" });
  });

  it("supports a custom field name and bodiless requests", async () => {
    const custom = new HoneypotMiddleware("website").handle;
    expect((await request(appWith(custom)).post("/").send({ website: "bot" })).body.success).toBe(
      true,
    );
    expect((await request(appWith(hp)).get("/")).status).toBe(200);
  });
});

describe("IpAbuseMiddleware", () => {
  afterEach(() => jest.useRealTimers());

  const call = (mw: IpAbuseMiddleware, ip = "1.1.1.1") =>
    new Promise<unknown>((resolve) =>
      mw.handle({ ip, socket: {}, headers: {} } as unknown as Request, {} as never, (e?: unknown) =>
        resolve(e),
      ),
    );

  it("allows up to the threshold then rejects with 403", async () => {
    const mw = new IpAbuseMiddleware(60_000, 3);
    for (let i = 0; i < 3; i++) expect(await call(mw)).toBeUndefined();
    expect(await call(mw)).toBeInstanceOf(ForbiddenError);
    expect(await call(mw)).toBeInstanceOf(ForbiddenError);
    expect(await call(mw, "2.2.2.2")).toBeUndefined();
  });

  it("resets after the window", async () => {
    jest.useFakeTimers();
    const mw = new IpAbuseMiddleware(1_000, 1);
    expect(await call(mw)).toBeUndefined();
    expect(await call(mw)).toBeInstanceOf(ForbiddenError);
    jest.advanceTimersByTime(1_001);
    expect(await call(mw)).toBeUndefined();
  });

  it("start() is idempotent and the cleanup sweep evicts stale IPs; stop() clears it", async () => {
    jest.useFakeTimers();
    const mw = new IpAbuseMiddleware(1_000, 1, 500);
    mw.start();
    mw.start();
    await call(mw);
    expect(await call(mw)).toBeInstanceOf(ForbiddenError);
    jest.advanceTimersByTime(1_500);
    expect(await call(mw)).toBeUndefined();
    mw.stop();
    mw.stop();
    expect(jest.getTimerCount()).toBe(0);
  });
});
