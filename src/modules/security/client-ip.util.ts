import type { Request } from "express";

/**
 * Client IP for logging / abuse tracking / audit fields.
 *
 * Uses `req.ip`, which Express derives from X-Forwarded-For according to the
 * app's `trust proxy` setting (only hops added by trusted proxies are
 * honoured). Reading the *first* X-Forwarded-For entry directly would let any
 * client spoof its IP by sending the header itself.
 */
export const getClientIp = (req: Request): string =>
  req.ip ?? req.socket?.remoteAddress ?? "unknown";
