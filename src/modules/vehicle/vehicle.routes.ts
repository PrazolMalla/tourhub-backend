import { Router } from "express";
import type { VehicleController } from "./vehicle.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { PaginationMiddleware } from "../../core/middlewares/pagination.middleware";
import { publicCache } from "../../core/middlewares/cache-control.middleware";
import { AppConstants } from "../../constants";
import { VehicleValidator } from "./vehicle.validator";
import { uploaderFor } from "../../core/utils/uploads";

export class VehicleRoutes {
  constructor(private readonly controller: VehicleController) {}

  getRouter(): Router {
    const router = Router();
    const upload = uploaderFor("vehicle", 1);

    const pagination = PaginationMiddleware.create({
      allowedSortFields: ["sortOrder", "name", "createdAt"],
      defaultSortBy: "sortOrder",
      defaultSortOrder: "asc",
    });

    const vehicleCache = publicCache({ maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 600 });

    // ── Public ──────────────────────────────────────────────────
    router.get("/public", vehicleCache, pagination, this.controller.publicList);
    router.get(
      "/public/slug/:slug",
      vehicleCache,
      ValidateMiddleware.params(VehicleValidator.slugParam),
      this.controller.publicBySlug,
    );

    // ── Staff ───────────────────────────────────────────────────
    router.use(AuthMiddleware.create());
    router.use(AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES));

    router.get("/", pagination, this.controller.list);
    router.get(
      "/:id",
      ValidateMiddleware.params(VehicleValidator.idParam),
      this.controller.getById,
    );
    router.post("/", ValidateMiddleware.body(VehicleValidator.create), this.controller.create);
    router.patch(
      "/:id",
      ValidateMiddleware.params(VehicleValidator.idParam),
      ValidateMiddleware.body(VehicleValidator.update),
      this.controller.update,
    );
    router.post(
      "/:id/archive",
      ValidateMiddleware.params(VehicleValidator.idParam),
      this.controller.archive,
    );
    router.post(
      "/:id/unarchive",
      ValidateMiddleware.params(VehicleValidator.idParam),
      this.controller.unarchive,
    );
    router.delete(
      "/:id",
      ValidateMiddleware.params(VehicleValidator.idParam),
      this.controller.delete,
    );
    router.post(
      "/:id/image",
      ValidateMiddleware.params(VehicleValidator.idParam),
      upload.single("image"),
      this.controller.uploadImage,
    );
    router.delete(
      "/:id/image",
      ValidateMiddleware.params(VehicleValidator.idParam),
      this.controller.removeImage,
    );
    router.patch(
      "/:id/image/alt",
      ValidateMiddleware.params(VehicleValidator.idParam),
      ValidateMiddleware.body(VehicleValidator.imageAltBody),
      this.controller.updateImageAlt,
    );

    return router;
  }
}
