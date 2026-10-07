import { Router } from "express";
import type { RegionController } from "./region.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { PaginationMiddleware } from "../../core/middlewares/pagination.middleware";
import { publicCache } from "../../core/middlewares/cache-control.middleware";
import { AppConstants } from "../../constants";
import { RegionValidator } from "./region.validator";
import { uploaderFor } from "../../core/utils/uploads";

export class RegionRoutes {
  constructor(private readonly controller: RegionController) {}

  getRouter(): Router {
    const router = Router();
    const upload = uploaderFor("region", 1);

    const publicRegionCache = publicCache();
    const publicPagination = PaginationMiddleware.create({
      allowedSortFields: ["createdAt", "name", "sortOrder"],
      defaultSortBy: "sortOrder",
      defaultSortOrder: "asc",
    });

    // Public reads — active regions, safe to share across all visitors.
    router.get("/public", publicRegionCache, publicPagination, this.controller.publicList);
    router.get(
      "/public/slug/:slug",
      publicRegionCache,
      ValidateMiddleware.params(RegionValidator.slugParam),
      this.controller.publicGetBySlug,
    );
    router.get(
      "/public/:id",
      publicRegionCache,
      ValidateMiddleware.params(RegionValidator.idParam),
      this.controller.publicGetById,
    );

    // Staff endpoints
    router.use(AuthMiddleware.create());
    router.use(AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES));

    router.get(
      "/",
      PaginationMiddleware.create({
        allowedSortFields: ["createdAt", "name", "sortOrder"],
        defaultSortBy: "sortOrder",
        defaultSortOrder: "asc",
      }),
      this.controller.list,
    );

    router.get("/:id", ValidateMiddleware.params(RegionValidator.idParam), this.controller.getById);

    router.post("/", ValidateMiddleware.body(RegionValidator.create), this.controller.create);

    router.patch(
      "/:id",
      ValidateMiddleware.params(RegionValidator.idParam),
      ValidateMiddleware.body(RegionValidator.update),
      this.controller.update,
    );

    router.post(
      "/:id/archive",
      ValidateMiddleware.params(RegionValidator.idParam),
      this.controller.archive,
    );

    router.post(
      "/:id/unarchive",
      ValidateMiddleware.params(RegionValidator.idParam),
      this.controller.unarchive,
    );

    router.delete(
      "/:id",
      ValidateMiddleware.params(RegionValidator.idParam),
      this.controller.delete,
    );

    router.post(
      "/:id/image",
      ValidateMiddleware.params(RegionValidator.idParam),
      upload.single("image"),
      this.controller.uploadImage,
    );

    router.delete(
      "/:id/image",
      ValidateMiddleware.params(RegionValidator.idParam),
      this.controller.removeImage,
    );

    return router;
  }
}
