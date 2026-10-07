import type { RequestHandler } from "express";
import rateLimit, { type Options } from "express-rate-limit";
import { env } from "../../config/env";
import { AppConstants } from "../../constants";

export type RateLimitScope = "global" | "auth" | "trip" | "enquiry" | "admin";

interface ScopeConfig {
  windowMs: number;
  max: number;
  message: string;
}

const SCOPE_CONFIG: Record<RateLimitScope, ScopeConfig> = {
  global: {
    windowMs: AppConstants.RATE_LIMIT_GLOBAL_WINDOW_MS,
    max: AppConstants.RATE_LIMIT_GLOBAL_MAX,
    message: "Too many requests from this IP, please try again later.",
  },
  auth: {
    windowMs: AppConstants.RATE_LIMIT_AUTH_WINDOW_MS,
    max: AppConstants.RATE_LIMIT_AUTH_MAX,
    message: "Too many authentication attempts, please try again later.",
  },
  trip: {
    windowMs: AppConstants.RATE_LIMIT_PUBLIC_API_WINDOW_MS,
    max: AppConstants.RATE_LIMIT_PUBLIC_API_MAX,
    message: "API limit exceeded.",
  },
  enquiry: {
    windowMs: AppConstants.RATE_LIMIT_PUBLIC_SUBMIT_WINDOW_MS,
    max: AppConstants.RATE_LIMIT_PUBLIC_SUBMIT_MAX,
    message: "Submission limit exceeded, please try again later.",
  },
  admin: {
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "Too many requests, please try again later.",
  },
};

/**
 * Outside of production we bypass rate limits entirely — dev hot-reloads and
 * test suites trip the limiter constantly, which is more noise than safety.
 * Toggle via DISABLE_RATE_LIMITS=true (or NODE_ENV !== "production").
 */
const RATE_LIMITS_DISABLED = env.NODE_ENV !== "production" || env.DISABLE_RATE_LIMITS;

/** Per-scope express-rate-limit handlers, config sourced from env/constants. */
export class DynamicRateLimitMiddleware {
  private static handlers = new Map<RateLimitScope, RequestHandler>();

  static for(scope: RateLimitScope): RequestHandler {
    if (RATE_LIMITS_DISABLED) {
      return (_req, _res, next) => next();
    }
    const existing = this.handlers.get(scope);
    if (existing) return existing;

    const cfg = SCOPE_CONFIG[scope];
    const options: Partial<Options> = {
      windowMs: cfg.windowMs,
      max: cfg.max,
      message: {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: cfg.message,
        },
      },
      standardHeaders: "draft-7",
      legacyHeaders: false,
    };
    const handler = rateLimit(options);
    this.handlers.set(scope, handler);
    return handler;
  }
}
