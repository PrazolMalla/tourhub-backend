import { Router } from "express";
import type { UserController } from "./user.controller";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { PaginationMiddleware } from "../../core/middlewares/pagination.middleware";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { AppConstants } from "../../constants";
import { UserValidator } from "./user.validator";

export class UserRoutes {
  constructor(private readonly controller: UserController) {}

  getRouter(): Router {
    const router = Router();

    router.use(AuthMiddleware.create());

    router.get(
      "/",
      AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES),
      PaginationMiddleware.create({
        allowedSortFields: ["createdAt", "updatedAt", "email", "name"],
        defaultSortBy: "createdAt",
        defaultSortOrder: "desc",
      }),
      this.controller.list,
    );

    router.get("/me", this.controller.getMe);

    router.get(
      "/:id",
      AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES),
      ValidateMiddleware.params(UserValidator.idParam),
      this.controller.getById,
    );

    router.patch(
      "/:id",
      AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES),
      ValidateMiddleware.params(UserValidator.idParam),
      ValidateMiddleware.body(UserValidator.update),
      this.controller.update,
    );

    router.post(
      "/:id/ban",
      AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES),
      ValidateMiddleware.params(UserValidator.idParam),
      ValidateMiddleware.body(UserValidator.ban),
      this.controller.ban,
    );

    router.delete(
      "/:id/ban",
      AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES),
      ValidateMiddleware.params(UserValidator.idParam),
      this.controller.unban,
    );

    router.delete(
      "/:id",
      AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES),
      ValidateMiddleware.params(UserValidator.idParam),
      this.controller.delete,
    );

    return router;
  }
}
