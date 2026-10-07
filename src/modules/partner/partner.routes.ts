import { Router } from "express";
import type { PartnerController } from "./partner.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { PaginationMiddleware } from "../../core/middlewares/pagination.middleware";
import { publicCache } from "../../core/middlewares/cache-control.middleware";
import { AppConstants } from "../../constants";
import { PartnerValidator } from "./partner.validator";
import { uploaderFor } from "../../core/utils/uploads";

export class PartnerRoutes {
  constructor(private readonly controller: PartnerController) {}

  getRouter(): Router {
    const router = Router();
    const upload = uploaderFor("partner", 1);

    const partnerPagination = PaginationMiddleware.create({
      allowedSortFields: ["createdAt", "sortOrder", "name"],
      defaultSortBy: "sortOrder",
      defaultSortOrder: "asc",
    });

    // Public read — active partner logos, lightly cached.
    router.get("/public", publicCache(), partnerPagination, this.controller.publicList);

    // Staff endpoints
    router.use(AuthMiddleware.create());
    router.use(AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES));

    router.get("/", partnerPagination, this.controller.list);

    router.get(
      "/:id",
      ValidateMiddleware.params(PartnerValidator.idParam),
      this.controller.getById,
    );

    router.post("/", ValidateMiddleware.body(PartnerValidator.create), this.controller.create);

    router.patch(
      "/:id",
      ValidateMiddleware.params(PartnerValidator.idParam),
      ValidateMiddleware.body(PartnerValidator.update),
      this.controller.update,
    );

    router.post(
      "/:id/archive",
      ValidateMiddleware.params(PartnerValidator.idParam),
      this.controller.archive,
    );

    router.post(
      "/:id/unarchive",
      ValidateMiddleware.params(PartnerValidator.idParam),
      this.controller.unarchive,
    );

    router.delete(
      "/:id",
      ValidateMiddleware.params(PartnerValidator.idParam),
      this.controller.delete,
    );

    router.post(
      "/:id/image",
      ValidateMiddleware.params(PartnerValidator.idParam),
      upload.single("image"),
      this.controller.uploadImage,
    );

    router.delete(
      "/:id/image",
      ValidateMiddleware.params(PartnerValidator.idParam),
      this.controller.removeImage,
    );

    return router;
  }
}
