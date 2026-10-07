import { Router } from "express";
import type { TripController } from "./trip.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { PaginationMiddleware } from "../../core/middlewares/pagination.middleware";
import { publicCache } from "../../core/middlewares/cache-control.middleware";
import { AppConstants } from "../../constants";
import { TripValidator } from "./trip.validator";
import { uploaderFor } from "../../core/utils/uploads";
import { DynamicRateLimitMiddleware } from "../rate-limit-config/dynamic-rate-limit.middleware";

export class TripRoutes {
  constructor(private readonly controller: TripController) {}

  getRouter(): Router {
    const router = Router();
    const upload = uploaderFor("trip", 20);

    const publicPagination = PaginationMiddleware.create({
      allowedSortFields: ["createdAt", "title", "days", "price"],
      defaultSortBy: "createdAt",
      defaultSortOrder: "desc",
      maxLimit: 200,
    });

    // Public reads — shorter cache than site-content because featured treks and
    // seasonal availability turn over more often. SWR keeps listings snappy even
    // when the cache window is short.
    const publicTripCache = publicCache({ maxAge: 30, sMaxAge: 120, staleWhileRevalidate: 300 });
    const publicTripRateLimit = DynamicRateLimitMiddleware.for("trip");

    router.get(
      "/public",
      publicTripRateLimit,
      publicTripCache,
      publicPagination,
      this.controller.publicList,
    );
    router.get(
      "/public/slug/:slug",
      publicTripRateLimit,
      publicTripCache,
      ValidateMiddleware.params(TripValidator.slugParam),
      this.controller.publicGetBySlug,
    );
    router.get(
      "/public/:id",
      publicTripRateLimit,
      publicTripCache,
      ValidateMiddleware.params(TripValidator.idParam),
      this.controller.publicGetById,
    );

    // Staff endpoints
    router.use(AuthMiddleware.create());
    router.use(AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES));

    router.get(
      "/",
      PaginationMiddleware.create({
        allowedSortFields: ["createdAt", "title", "days"],
        defaultSortBy: "createdAt",
        defaultSortOrder: "desc",
      }),
      this.controller.list,
    );

    router.get("/:id", ValidateMiddleware.params(TripValidator.idParam), this.controller.getById);

    router.post("/", ValidateMiddleware.body(TripValidator.create), this.controller.create);

    router.patch(
      "/:id",
      ValidateMiddleware.params(TripValidator.idParam),
      ValidateMiddleware.body(TripValidator.update),
      this.controller.update,
    );

    router.post(
      "/:id/archive",
      ValidateMiddleware.params(TripValidator.idParam),
      this.controller.archive,
    );

    router.post(
      "/:id/unarchive",
      ValidateMiddleware.params(TripValidator.idParam),
      this.controller.unarchive,
    );

    router.delete("/:id", ValidateMiddleware.params(TripValidator.idParam), this.controller.delete);

    router.post(
      "/:id/images",
      ValidateMiddleware.params(TripValidator.idParam),
      upload.array("images", 20),
      this.controller.uploadImages,
    );

    router.delete(
      "/:id/images",
      ValidateMiddleware.params(TripValidator.idParam),
      ValidateMiddleware.body(TripValidator.imagePathBody),
      this.controller.removeImage,
    );

    router.post(
      "/:id/images/primary",
      ValidateMiddleware.params(TripValidator.idParam),
      ValidateMiddleware.body(TripValidator.imagePathBody),
      this.controller.setPrimaryImage,
    );

    router.patch(
      "/:id/images/reorder",
      ValidateMiddleware.params(TripValidator.idParam),
      ValidateMiddleware.body(TripValidator.imageReorderBody),
      this.controller.reorderImages,
    );

    router.patch(
      "/:id/images/meta",
      ValidateMiddleware.params(TripValidator.idParam),
      ValidateMiddleware.body(TripValidator.imageMetaBody),
      this.controller.updateImageAlt,
    );

    return router;
  }
}
