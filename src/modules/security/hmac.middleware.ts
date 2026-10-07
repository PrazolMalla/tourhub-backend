import crypto from "crypto";
import type { RequestHandler } from "express";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { UnauthorizedError } from "../../core/errors";

export interface HmacConfig {
  secret: string;
  apiKey: string;
  toleranceMs: number;
}

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;

export class HmacMiddleware {
  constructor(private readonly config: HmacConfig) {}

  /**
   * Builds an instance from environment variables. Throws if HMAC_SECRET or API_KEY are
   * unset — there are no insecure defaults here on purpose; the middleware refuses to
   * operate without explicit secrets.
   */
  static fromEnv(): HmacMiddleware {
    if (!env.HMAC_SECRET) {
      throw new Error("HMAC_SECRET env var is required to enable HmacMiddleware");
    }
    if (!env.API_KEY) {
      throw new Error("API_KEY env var is required to enable HmacMiddleware");
    }
    return new HmacMiddleware({
      secret: env.HMAC_SECRET,
      apiKey: env.API_KEY,
      toleranceMs: env.REQUEST_TIMESTAMP_TOLERANCE_MS ?? DEFAULT_TOLERANCE_MS,
    });
  }

  public handle: RequestHandler = (req, _res, next) => {
    try {
      const apiKey = req.headers["x-api-key"];
      const timestamp = req.headers["x-request-timestamp"];
      const signature = req.headers["x-signature"];
      const deviceId = req.headers["x-device-id"];
      const platform = req.headers["x-platform"];

      if (typeof apiKey !== "string" || apiKey !== this.config.apiKey) {
        throw new UnauthorizedError("Invalid or missing API key");
      }

      if (typeof timestamp !== "string") {
        throw new UnauthorizedError("Missing request timestamp");
      }

      const requestAge = Math.abs(Date.now() - parseInt(timestamp, 10));
      if (Number.isNaN(requestAge) || requestAge > this.config.toleranceMs) {
        logger.warn("Stale request rejected", {
          age: requestAge,
          tolerance: this.config.toleranceMs,
          deviceId: typeof deviceId === "string" ? deviceId : "unknown",
          platform: typeof platform === "string" ? platform : "unknown",
        });
        throw new UnauthorizedError("Request timestamp expired");
      }

      if (typeof signature !== "string") {
        throw new UnauthorizedError("Missing request signature");
      }

      const method = req.method.toUpperCase();
      const path = req.originalUrl.split("?")[0] ?? req.originalUrl;
      const queryString = req.originalUrl.includes("?")
        ? (req.originalUrl.split("?")[1] ?? "")
        : "";
      const contentType =
        typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : "";
      const bodyString = req.body && typeof req.body === "object" ? JSON.stringify(req.body) : "";

      const expectedSignature = this.computeSignature({
        timestamp,
        path,
        queryString,
        body: bodyString,
        method,
        contentType,
      });

      if (!HmacMiddleware.safeCompare(signature, expectedSignature)) {
        logger.warn("HMAC signature mismatch", {
          path,
          method,
          deviceId: typeof deviceId === "string" ? deviceId : "unknown",
        });
        throw new UnauthorizedError("Invalid request signature");
      }

      logger.http(`HMAC verified: ${method} ${path}`, {
        deviceId: typeof deviceId === "string" ? deviceId : "unknown",
        platform: typeof platform === "string" ? platform : "unknown",
      });

      next();
    } catch (err) {
      next(err);
    }
  };

  private computeSignature(parts: {
    timestamp: string;
    path: string;
    queryString: string;
    body: string;
    method: string;
    contentType: string;
  }): string {
    const { timestamp, path, queryString, body, method, contentType } = parts;
    let payload: string;
    if (method === "GET" || method === "DELETE") {
      payload = `${timestamp}${path}${queryString ? "?" + queryString : ""}`;
    } else {
      payload = contentType.includes("multipart/form-data")
        ? `${timestamp}${path}`
        : `${timestamp}${path}${body}`;
    }
    return crypto.createHmac("sha256", this.config.secret).update(payload).digest("hex");
  }

  private static safeCompare(a: string, b: string): boolean {
    // Compare byte lengths — equal string lengths can still differ in bytes
    // (multi-byte chars), which would make timingSafeEqual throw.
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
