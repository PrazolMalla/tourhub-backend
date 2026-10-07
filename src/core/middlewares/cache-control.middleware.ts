import type { NextFunction, Request, Response } from "express";

/**
 * Public-cache middleware for endpoints that are safe to share between every
 * unauthenticated visitor (site-content sections, banners, the public product
 * list). Sets a Cache-Control header that lets a CDN / reverse proxy / the
 * Next.js fetch cache reuse the same response without round-tripping us:
 *
 *   - max-age=N       → browser caches the response for N seconds
 *   - s-maxage=M      → shared caches (CDN, Next data cache) keep it for M
 *   - stale-while-revalidate=S → after expiry, serve stale for up to S more
 *     seconds while we refresh in the background
 *
 * Defaults are tuned for "live but not real-time" content: short browser TTL
 * (so visitors don't feel laggy after refreshing), longer edge TTL (so the
 * origin barely sees traffic), generous SWR window (so transient origin
 * blips don't surface as 5xx).
 *
 * Skips the header entirely when the request is authenticated — we only want
 * this on the truly public surface.
 */
export interface PublicCacheOptions {
  /** Browser cache TTL in seconds (default 60). */
  maxAge?: number;
  /** Shared / CDN cache TTL in seconds (default 300). */
  sMaxAge?: number;
  /** Stale-while-revalidate window in seconds (default 600). */
  staleWhileRevalidate?: number;
}

export function publicCache(opts: PublicCacheOptions = {}) {
  const maxAge = opts.maxAge ?? 60;
  const sMaxAge = opts.sMaxAge ?? 300;
  const swr = opts.staleWhileRevalidate ?? 600;
  const header = `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;

  return (req: Request, res: Response, next: NextFunction) => {
    // Never cache an authenticated response — even if the route is "public",
    // an Authorization header means the consumer might receive per-user
    // information we don't want pinned at a shared cache.
    if (req.headers.authorization) return next();
    res.setHeader("Cache-Control", header);
    // Vary on Accept so JSON and (future) HTML responses don't collide in a
    // shared cache keyed only by URL.
    res.setHeader("Vary", "Accept");
    next();
  };
}
