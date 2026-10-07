import { Router } from "express";
import type { DashboardController } from "./dashboard.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { AppConstants } from "../../constants";

export class DashboardRoutes {
  constructor(private readonly controller: DashboardController) {}

  getRouter(): Router {
    const router = Router();
    router.use(AuthMiddleware.create());
    // Staff-only (superadmin + admin). Customer JWTs are rejected by the
    // kind === "admin" check inside AuthorizeMiddleware.
    router.use(AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES));

    router.get("/summary", this.controller.summary);

    return router;
  }
}
