import { Router } from "express";
import type { AdminManagementController } from "./admin-management.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { PaginationMiddleware } from "../../core/middlewares/pagination.middleware";
import { AppConstants } from "../../constants";
import { AdminManagementValidator } from "./admin-management.validator";

export class AdminManagementRoutes {
  constructor(private readonly controller: AdminManagementController) {}

  getRouter(): Router {
    const router = Router();
    router.use(AuthMiddleware.create());
    router.use(AuthorizeMiddleware.roles(AppConstants.ROLE_SUPERADMIN));

    router.get(
      "/",
      PaginationMiddleware.create({
        allowedSortFields: ["createdAt", "email", "name"],
        defaultSortBy: "createdAt",
        defaultSortOrder: "desc",
      }),
      this.controller.list,
    );

    router.post(
      "/",
      ValidateMiddleware.body(AdminManagementValidator.create),
      this.controller.create,
    );

    // Destructive "factory reset" — must come before `/:id` routes so the
    // literal path wins ahead of the ObjectId param matcher.
    router.post(
      "/clear-database",
      ValidateMiddleware.body(AdminManagementValidator.clearDatabase),
      this.controller.clearDatabase,
    );

    router.patch(
      "/:id",
      ValidateMiddleware.params(AdminManagementValidator.idParam),
      ValidateMiddleware.body(AdminManagementValidator.update),
      this.controller.update,
    );

    router.delete(
      "/:id",
      ValidateMiddleware.params(AdminManagementValidator.idParam),
      this.controller.delete,
    );

    router.post(
      "/:id/ban",
      ValidateMiddleware.params(AdminManagementValidator.idParam),
      ValidateMiddleware.body(AdminManagementValidator.ban),
      this.controller.ban,
    );

    router.post(
      "/:id/unban",
      ValidateMiddleware.params(AdminManagementValidator.idParam),
      this.controller.unban,
    );

    return router;
  }
}
