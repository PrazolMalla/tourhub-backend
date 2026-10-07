import type { CookieOptions, Response } from "express";
import { env } from "../../config/env";
import { AppConstants } from "../../constants";
import { parseDurationToMs } from "../../core/utils/duration.util";

export class CookieService {
  private baseOptions(): CookieOptions {
    // SameSite is configurable via `COOKIE_SAME_SITE` (defaults to `lax`).
    // The previous hardcoded `"none"` for production silently disabled
    // SameSite's CSRF protection on every state-changing endpoint — see
    // qa-test.md#H-2.
    //
    // `lax` is the recommended default: blocks cross-site POST/PATCH/DELETE
    // (CSRF) but allows OAuth top-level redirects and same-site XHR.
    //
    // Only switch to `none` if the api / admin / customer live on totally
    // different registrable domains AND you've added a CSRF token layer.
    const opts: CookieOptions = {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: env.COOKIE_SAME_SITE,
    };
    // Skip Domain on localhost — browsers reject cookies whose Domain
    // attribute doesn't match the response host, so a committed prod
    // value like `.himaalpure.com` would silently drop every auth cookie
    // during `pnpm dev` and the user would appear logged-out immediately
    // after OAuth callback.
    if (env.COOKIE_DOMAIN && env.NODE_ENV !== "development") {
      opts.domain = env.COOKIE_DOMAIN;
    }
    return opts;
  }

  setAuthCookie(res: Response, token: string): void {
    res.cookie(AppConstants.AUTH_COOKIE_NAME, token, {
      ...this.baseOptions(),
      path: "/",
      maxAge: parseDurationToMs(env.JWT_ACCESS_EXPIRES_IN),
    });
  }

  setRefreshCookie(res: Response, token: string): void {
    res.cookie(AppConstants.REFRESH_COOKIE_NAME, token, {
      ...this.baseOptions(),
      path: AppConstants.REFRESH_COOKIE_PATH,
      maxAge: parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN),
    });
  }

  clearAuthCookie(res: Response): void {
    res.clearCookie(AppConstants.AUTH_COOKIE_NAME, {
      ...this.baseOptions(),
      path: "/",
    });
  }

  clearRefreshCookie(res: Response): void {
    res.clearCookie(AppConstants.REFRESH_COOKIE_NAME, {
      ...this.baseOptions(),
      path: AppConstants.REFRESH_COOKIE_PATH,
    });
  }
}

export default new CookieService();
