import type { Router } from "express";
import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { AdminRepository } from "../../admin/admin.repository";
import { AuthRepository } from "../auth.repository";
import { AuthService } from "../auth.service";
import { RefreshTokenRepository } from "../refresh-token.repository";
import { GoogleOAuthController } from "./google.controller";
import { GoogleOAuthRoutes } from "./google.routes";
import { GoogleOAuthService } from "./google.service";

const ADMIN_OAUTH_MOUNT_PATH = "/api/v1/auth/admin/google";

export class GoogleOAuthModule {
  static create(): Router | null {
    if (!env.GOOGLE_CLIENT_ID) {
      logger.info("Google OAuth: skipped (GOOGLE_CLIENT_ID unset)");
      return null;
    }

    if (
      !env.GOOGLE_CLIENT_SECRET ||
      !env.GOOGLE_CALLBACK_URL ||
      !env.OAUTH_STATE_SECRET ||
      !env.OAUTH_SUCCESS_REDIRECT_URL ||
      !env.OAUTH_FAILURE_REDIRECT_URL
    ) {
      logger.warn("Google OAuth: skipped (incomplete env)");
      return null;
    }

    const googleService = new GoogleOAuthService(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_CALLBACK_URL,
    );
    const authService = new AuthService(
      new AuthRepository(),
      new AdminRepository(),
      new RefreshTokenRepository(),
    );

    const controller = new GoogleOAuthController(googleService, authService, {
      kind: "user",
      stateSecret: env.OAUTH_STATE_SECRET,
      successUrl: env.OAUTH_SUCCESS_REDIRECT_URL,
      failureUrl: env.OAUTH_FAILURE_REDIRECT_URL,
    });

    logger.info("Google OAuth: enabled at /api/v1/auth/google");
    return new GoogleOAuthRoutes(controller).getRouter();
  }

  /**
   * Admin-only Google OAuth router. Looks up / creates in the `admins`
   * collection — customer accounts cannot complete login here. Unknown
   * Google accounts are persisted as blocked admin shells for SuperAdmin
   * to audit / unblock.
   */
  static createForAdmin(): Router | null {
    if (!env.ADMIN_GOOGLE_CALLBACK_URL) {
      logger.info("Admin Google OAuth: skipped (ADMIN_GOOGLE_CALLBACK_URL unset)");
      return null;
    }

    if (
      !env.GOOGLE_CLIENT_ID ||
      !env.GOOGLE_CLIENT_SECRET ||
      !env.OAUTH_STATE_SECRET ||
      !env.ADMIN_OAUTH_SUCCESS_REDIRECT_URL ||
      !env.ADMIN_OAUTH_FAILURE_REDIRECT_URL
    ) {
      logger.warn("Admin Google OAuth: skipped (incomplete env)");
      return null;
    }

    const googleService = new GoogleOAuthService(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.ADMIN_GOOGLE_CALLBACK_URL,
    );
    const authService = new AuthService(
      new AuthRepository(),
      new AdminRepository(),
      new RefreshTokenRepository(),
    );

    const controller = new GoogleOAuthController(googleService, authService, {
      kind: "admin",
      stateSecret: env.OAUTH_STATE_SECRET,
      successUrl: env.ADMIN_OAUTH_SUCCESS_REDIRECT_URL,
      failureUrl: env.ADMIN_OAUTH_FAILURE_REDIRECT_URL,
      stateCookiePath: ADMIN_OAUTH_MOUNT_PATH,
      autoBlockUnauthorized: true,
    });

    logger.info(`Admin Google OAuth: enabled at ${ADMIN_OAUTH_MOUNT_PATH}`);
    return new GoogleOAuthRoutes(controller).getRouter();
  }
}

export default GoogleOAuthModule.create();
export const adminGoogleOAuthRoutes = GoogleOAuthModule.createForAdmin();
