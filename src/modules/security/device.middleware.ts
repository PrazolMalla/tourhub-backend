import crypto from "crypto";
import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../core/errors";
import { getClientIp } from "./client-ip.util";

export interface DeviceInfo {
  deviceId: string;
  userAgent: string;
  browser: string;
  os: string;
  ip: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      deviceInfo?: DeviceInfo;
    }
  }
}

const parseBrowser = (ua: string): string => {
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("OPR") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  return "Unknown";
};

// Order matters: Android UAs also contain "Linux", and iOS UAs contain
// "like Mac OS X", so the mobile checks must run first.
const parseOS = (ua: string): string => {
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad") || ua.includes("iPod")) return "iOS";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  return "Unknown";
};

const fingerprint = (clientDeviceId: string, userAgent: string): string =>
  crypto
    .createHash("sha256")
    .update(`${clientDeviceId}::${userAgent}`)
    .digest("hex")
    .substring(0, 40);

/**
 * Parses device details from headers (x-device-id, user-agent) and the connection (IP)
 * and attaches the result to `req.deviceInfo`. Falls back to a UA+IP-derived fingerprint
 * when the client doesn't send `x-device-id`.
 */
export class AttachDeviceMiddleware {
  public handle: RequestHandler = (req, _res, next) => {
    const clientDeviceId =
      typeof req.headers["x-device-id"] === "string" ? req.headers["x-device-id"] : "";
    const userAgent =
      typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "";

    const deviceId = clientDeviceId
      ? fingerprint(clientDeviceId, userAgent)
      : fingerprint("no-device-id", userAgent + getClientIp(req));

    req.deviceInfo = {
      deviceId,
      userAgent,
      browser: parseBrowser(userAgent),
      os: parseOS(userAgent),
      ip: getClientIp(req),
    };

    next();
  };
}

/**
 * Enforces that `req.deviceInfo` was set upstream — typically used after `protect`
 * for routes that gate access by device.
 */
export class VerifyDeviceMiddleware {
  public handle: RequestHandler = (req, _res, next) => {
    if (!req.deviceInfo) {
      next(new UnauthorizedError("Device info required"));
      return;
    }
    next();
  };
}
