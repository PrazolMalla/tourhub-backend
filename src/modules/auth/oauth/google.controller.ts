import type { Request, Response } from "express";
import { asyncHandler } from "../../../core/middlewares/async-handler";
import { logger } from "../../../config/logger";
import { env } from "../../../config/env";
import cookieService from "../../../utils/auth/cookie.util";
import { getClientIp } from "../../security/client-ip.util";
import { AppConstants } from "../../../constants";
import type { AuthService } from "../auth.service";
import type { LoginContext } from "../auth.types";
import type { GoogleOAuthService } from "./google.service";
import type { OAuthErrorCode } from "./oauth.types";
import {
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_TTL_MS,
  issueOAuthState,
  verifyOAuthState,
} from "./oauth-state.util";

const DEFAULT_STATE_COOKIE_PATH = "/api/v1/auth/google";

export interface GoogleOAuthControllerConfig {
  /** Which side of the split this controller serves. */
  kind: "user" | "admin";
  stateSecret: string;
  successUrl: string;
  failureUrl: string;
  /** Cookie path for the OAuth state cookie. Must match the mount path of this controller's routes. */
  stateCookiePath?: string;
  /**
   * Admin-only: when true, an unknown email is persisted as a banned shell
   * in the `admins` collection so SuperAdmin can audit / un-ban. Ignored
   * for kind="user".
   */
  autoBlockUnauthorized?: boolean;
}

export class GoogleOAuthController {
  constructor(
    private readonly googleService: GoogleOAuthService,
    private readonly authService: AuthService,
    private readonly config: GoogleOAuthControllerConfig,
  ) {}

  start = asyncHandler(async (_req: Request, res: Response) => {
    const { state, cookie } = issueOAuthState(this.config.stateSecret);
    res.cookie(OAUTH_STATE_COOKIE_NAME, cookie, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: this.config.stateCookiePath ?? DEFAULT_STATE_COOKIE_PATH,
      maxAge: OAUTH_STATE_TTL_MS,
    });
    logger.info("Google OAuth: state issued", { kind: this.config.kind });
    res.redirect(this.googleService.buildAuthorizeUrl(state));
  });

  callback = asyncHandler(async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const stateCookie = (req.cookies as Record<string, unknown> | undefined)?.[
      OAUTH_STATE_COOKIE_NAME
    ];

    res.clearCookie(OAUTH_STATE_COOKIE_NAME, {
      path: this.config.stateCookiePath ?? DEFAULT_STATE_COOKIE_PATH,
    });

    if (typeof req.query.error === "string") {
      logger.warn("Google OAuth: provider denied", { error: req.query.error });
      return this.fail(res, "provider_denied");
    }

    if (!code || !state) {
      return this.fail(res, "missing_params");
    }

    if (
      !verifyOAuthState(
        this.config.stateSecret,
        state,
        typeof stateCookie === "string" ? stateCookie : undefined,
      )
    ) {
      logger.warn("Google OAuth: state mismatch");
      return this.fail(res, "state_mismatch");
    }

    let accessToken: string;
    try {
      const tokens = await this.googleService.exchangeCode(code);
      accessToken = tokens.access_token;
      logger.info("Google OAuth: code exchanged");
    } catch (err) {
      logger.warn("Google OAuth: code exchange failed", { err: String(err) });
      return this.fail(res, "code_exchange_failed");
    }

    let profile;
    try {
      profile = await this.googleService.fetchProfile(accessToken);
      logger.info("Google OAuth: profile fetched", { sub: profile.providerId });
    } catch (err) {
      logger.warn("Google OAuth: profile fetch failed", { err: String(err) });
      return this.fail(res, "profile_fetch_failed");
    }

    if (!profile.email) {
      return this.fail(res, "email_missing");
    }

    try {
      const ctx = this.buildCtx(req);
      const tokens =
        this.config.kind === "admin"
          ? await this.authService.loginAdminWithGoogle(
              profile,
              ctx,
              this.config.autoBlockUnauthorized ?? true,
            )
          : await this.authService.loginCustomerWithGoogle(profile, ctx);
      cookieService.setAuthCookie(res, tokens.accessToken);
      cookieService.setRefreshCookie(res, tokens.refreshToken);
      logger.info("Google OAuth: login complete", {
        providerId: profile.providerId,
        kind: this.config.kind,
      });
      return res.redirect(this.config.successUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (msg.includes("blocked") || msg.includes("banned")) {
        logger.warn("Google OAuth: blocked account attempted sign-in", {
          kind: this.config.kind,
          email: profile.email,
        });
        return this.fail(res, "blocked");
      }
      if (msg.includes("not authorized")) {
        logger.warn("Google OAuth: unauthorized account attempted sign-in", {
          kind: this.config.kind,
          email: profile.email,
        });
        return this.fail(res, "unauthorized");
      }
      if (msg.includes("inactive")) {
        return this.fail(res, "inactive");
      }
      logger.error("Google OAuth: upsert/issue-tokens failed", { err: String(err) });
      return this.fail(res, "internal");
    }
  });

  private buildCtx(req: Request): LoginContext {
    void AppConstants;
    const ip = getClientIp(req);
    const ua =
      typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;
    const deviceId =
      typeof req.headers["x-device-id"] === "string" && req.headers["x-device-id"].length > 0
        ? req.headers["x-device-id"]
        : undefined;
    const ctx: LoginContext = { ip };
    if (ua !== undefined) ctx.userAgent = ua;
    if (deviceId !== undefined) ctx.deviceId = deviceId;
    return ctx;
  }

  private fail(res: Response, code: OAuthErrorCode): void {
    const url = new URL(this.config.failureUrl);
    url.searchParams.set("error", code);
    res.redirect(url.toString());
  }
}
