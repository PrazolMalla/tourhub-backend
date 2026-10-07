import { Router } from "express";
import type { EnquiryController } from "./enquiry.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { PaginationMiddleware } from "../../core/middlewares/pagination.middleware";
import { AppConstants } from "../../constants";
import { DynamicRateLimitMiddleware } from "../rate-limit-config/dynamic-rate-limit.middleware";
import { EnquiryValidator } from "./enquiry.validator";

export class EnquiryRoutes {
  constructor(private readonly controller: EnquiryController) {}

  getRouter(): Router {
    const router = Router();

    // PUBLIC — lead capture (create). Rate-limited per the "enquiry" scope.
    router.post(
      "/",
      DynamicRateLimitMiddleware.for("enquiry"),
      ValidateMiddleware.body(EnquiryValidator.create),
      this.controller.create,
    );

    // Authenticated staff inbox below.
    router.use(AuthMiddleware.create());
    router.use(AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES));

    router.get(
      "/",
      PaginationMiddleware.create({
        allowedSortFields: ["createdAt", "status"],
        defaultSortBy: "createdAt",
        defaultSortOrder: "desc",
      }),
      this.controller.list,
    );

    // Register before "/:id" so it isn't shadowed by the param route.
    router.get("/unread-count", this.controller.unreadCount);

    router.get(
      "/:id",
      ValidateMiddleware.params(EnquiryValidator.idParam),
      this.controller.getById,
    );

    router.patch(
      "/:id",
      ValidateMiddleware.params(EnquiryValidator.idParam),
      ValidateMiddleware.body(EnquiryValidator.update),
      this.controller.update,
    );

    router.delete(
      "/:id",
      ValidateMiddleware.params(EnquiryValidator.idParam),
      this.controller.delete,
    );

    return router;
  }
}
