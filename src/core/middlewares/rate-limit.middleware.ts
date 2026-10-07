import rateLimit, { type Options } from "express-rate-limit";
import type { RequestHandler } from "express";
import { AppConstants } from "../../constants";

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
}

/**
 * Wraps `express-rate-limit` with our standard envelope + sane defaults.
 * Use the named factories for consistent route-group policies; use `create()`
 * for one-offs.
 */
export class RateLimitMiddleware {
  static create(config: RateLimitConfig): RequestHandler {
    const options: Partial<Options> = {
      windowMs: config.windowMs,
      max: config.max,
      message: {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: config.message ?? "Too many requests, please try again later.",
        },
      },
      standardHeaders: "draft-7",
      legacyHeaders: false,
    };
    return rateLimit(options);
  }

  static global(): RequestHandler {
    return RateLimitMiddleware.create({
      windowMs: AppConstants.RATE_LIMIT_GLOBAL_WINDOW_MS,
      max: AppConstants.RATE_LIMIT_GLOBAL_MAX,
      message: "Too many requests from this IP, please try again later.",
    });
  }

  static auth(): RequestHandler {
    return RateLimitMiddleware.create({
      windowMs: AppConstants.RATE_LIMIT_AUTH_WINDOW_MS,
      max: AppConstants.RATE_LIMIT_AUTH_MAX,
      message: "Too many authentication attempts, please try again later.",
    });
  }

  static publicSubmit(): RequestHandler {
    return RateLimitMiddleware.create({
      windowMs: AppConstants.RATE_LIMIT_PUBLIC_SUBMIT_WINDOW_MS,
      max: AppConstants.RATE_LIMIT_PUBLIC_SUBMIT_MAX,
      message: "Submission limit exceeded, please try again later.",
    });
  }

  static publicApi(): RequestHandler {
    return RateLimitMiddleware.create({
      windowMs: AppConstants.RATE_LIMIT_PUBLIC_API_WINDOW_MS,
      max: AppConstants.RATE_LIMIT_PUBLIC_API_MAX,
      message: "API limit exceeded.",
    });
  }

  /**
   * Tighter bucket for money endpoints (order create, payment initiate,
   * mark-paid). Each call has real downstream cost — eSewa API hit, stock
   * lock, audit row — so we cap aggressively per IP. See qa-test.md#M-1.
   */
  static money(): RequestHandler {
    return RateLimitMiddleware.create({
      windowMs: AppConstants.RATE_LIMIT_MONEY_WINDOW_MS,
      max: AppConstants.RATE_LIMIT_MONEY_MAX,
      message: "Too many money-related requests, please slow down.",
    });
  }
}
