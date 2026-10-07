import type { RequestHandler } from "express";
import { logger } from "../../config/logger";
import { ForbiddenError } from "../../core/errors";
import { getClientIp } from "./client-ip.util";

/**
 * Detects bot submissions via an invisible form field. The frontend must include a
 * hidden input named `fieldName`; if any non-empty value is posted, the request is
 * silently answered with a fake-success envelope so the bot doesn't know it was caught.
 */
export class HoneypotMiddleware {
  constructor(private readonly fieldName: string = "_hp_field") {}

  public handle: RequestHandler = (req, res, next) => {
    const value = (req.body as Record<string, unknown> | undefined)?.[this.fieldName];

    if (typeof value === "string" && value.trim() !== "") {
      logger.warn("Honeypot triggered — bot submission detected", {
        ip: getClientIp(req),
        userAgent: req.headers["user-agent"],
        honeypotValue: value,
      });
      res.status(200).json({
        success: true,
        data: { id: `honeypot-${Date.now()}` },
      });
      return;
    }

    if (req.body && typeof req.body === "object" && this.fieldName in req.body) {
      delete (req.body as Record<string, unknown>)[this.fieldName];
    }
    next();
  };
}

interface IpRecord {
  count: number;
  firstSeen: number;
  flagged: boolean;
}

/**
 * Tracks per-IP submission counts in memory; rejects requests once an IP exceeds the
 * threshold within the window. **Call `start()` before mounting and `stop()` during
 * graceful shutdown** so the cleanup interval doesn't leak.
 */
export class IpAbuseMiddleware {
  private readonly store = new Map<string, IpRecord>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly windowMs: number = 60 * 60 * 1000,
    private readonly threshold: number = 10,
    private readonly cleanupIntervalMs: number = 30 * 60 * 1000,
  ) {}

  start(): void {
    if (this.cleanupTimer !== null) return;
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [ip, record] of this.store.entries()) {
        if (now - record.firstSeen > this.windowMs) this.store.delete(ip);
      }
    }, this.cleanupIntervalMs);
    this.cleanupTimer.unref();
  }

  stop(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  public handle: RequestHandler = (req, _res, next) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const record = this.store.get(ip);

    if (!record || now - record.firstSeen > this.windowMs) {
      this.store.set(ip, { count: 1, firstSeen: now, flagged: false });
      next();
      return;
    }

    record.count += 1;

    if (record.count > this.threshold) {
      if (!record.flagged) {
        record.flagged = true;
        logger.warn("IP flagged for abuse — excessive submissions", {
          ip,
          count: record.count,
          windowMinutes: Math.round((now - record.firstSeen) / 60000),
          userAgent: req.headers["user-agent"],
        });
      }
      next(new ForbiddenError("Too many submissions from this IP. Please try again later."));
      return;
    }

    if (record.count === Math.floor(this.threshold * 0.7)) {
      logger.info("IP approaching abuse threshold", {
        ip,
        count: record.count,
        threshold: this.threshold,
      });
    }

    next();
  };
}
