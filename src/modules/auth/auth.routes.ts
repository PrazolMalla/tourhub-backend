import { Router } from "express";
import type { AuthController } from "./auth.controller";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { DynamicRateLimitMiddleware } from "../rate-limit-config/dynamic-rate-limit.middleware";
import { AuthValidator } from "./auth.validator";

export class AuthRoutes {
  constructor(private readonly controller: AuthController) {}

  getRouter(): Router {
    const router = Router();

    router.use(DynamicRateLimitMiddleware.for("auth"));

    router.post(
      "/register",
      ValidateMiddleware.body(AuthValidator.register),
      this.controller.register,
    );

    router.post("/login", ValidateMiddleware.body(AuthValidator.login), this.controller.login);

    router.post(
      "/admin/login",
      ValidateMiddleware.body(AuthValidator.login),
      this.controller.adminLogin,
    );

    router.post("/refresh", this.controller.refresh);
    router.post("/logout", this.controller.logout);

    // Kind-aware /me — dispatches to admins or users collection based on
    // the access token's `kind` claim. Used by the admin panel on hydrate.
    router.get("/me", AuthMiddleware.create(), this.controller.me);

    router.post(
      "/forget-password",
      ValidateMiddleware.body(AuthValidator.forgetPassword),
      this.controller.forgetPassword,
    );

    router.post(
      "/reset-password",
      ValidateMiddleware.body(AuthValidator.resetPassword),
      this.controller.resetPassword,
    );

    router.post(
      "/resend-otp",
      ValidateMiddleware.body(AuthValidator.resendOtp),
      this.controller.resendOtp,
    );

    return router;
  }
}
