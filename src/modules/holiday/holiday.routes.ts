import { Router } from "express";
import type { HolidayController } from "./holiday.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { PaginationMiddleware } from "../../core/middlewares/pagination.middleware";
import { publicCache } from "../../core/middlewares/cache-control.middleware";
import { AppConstants } from "../../constants";
import { HolidayValidator } from "./holiday.validator";
import { uploaderFor } from "../../core/utils/uploads";

export class HolidayRoutes {
  constructor(private readonly controller: HolidayController) {}

  getRouter(): Router {
    const router = Router();
    const upload = uploaderFor("holiday", 1);

    // Accept both camelCase and the snake_case names the landing site sends
    // (?sortBy=start_date). The service maps them to real Mongo fields.
    const pagination = PaginationMiddleware.create({
      allowedSortFields: [
        "startDate",
        "start_date",
        "endDate",
        "end_date",
        "discountPercentage",
        "discount_percentage",
        "name",
        "sortOrder",
        "createdAt",
      ],
      defaultSortBy: "startDate",
      defaultSortOrder: "asc",
    });

    const holidayCache = publicCache({ maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 600 });

    // ── Public ──────────────────────────────────────────────────
    router.get("/public", holidayCache, pagination, this.controller.publicList);
    router.get(
      "/public/slug/:slug",
      holidayCache,
      ValidateMiddleware.params(HolidayValidator.slugParam),
      this.controller.publicBySlug,
    );

    // ── Staff ───────────────────────────────────────────────────
    router.use(AuthMiddleware.create());
    router.use(AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES));

    router.get("/", pagination, this.controller.list);
    router.get(
      "/:id",
      ValidateMiddleware.params(HolidayValidator.idParam),
      this.controller.getById,
    );
    router.post("/", ValidateMiddleware.body(HolidayValidator.create), this.controller.create);
    router.patch(
      "/:id",
      ValidateMiddleware.params(HolidayValidator.idParam),
      ValidateMiddleware.body(HolidayValidator.update),
      this.controller.update,
    );
    router.post(
      "/:id/archive",
      ValidateMiddleware.params(HolidayValidator.idParam),
      this.controller.archive,
    );
    router.post(
      "/:id/unarchive",
      ValidateMiddleware.params(HolidayValidator.idParam),
      this.controller.unarchive,
    );
    router.delete(
      "/:id",
      ValidateMiddleware.params(HolidayValidator.idParam),
      this.controller.delete,
    );
    router.post(
      "/:id/image",
      ValidateMiddleware.params(HolidayValidator.idParam),
      upload.single("image"),
      this.controller.uploadImage,
    );
    router.delete(
      "/:id/image",
      ValidateMiddleware.params(HolidayValidator.idParam),
      this.controller.removeImage,
    );
    router.patch(
      "/:id/image/alt",
      ValidateMiddleware.params(HolidayValidator.idParam),
      ValidateMiddleware.body(HolidayValidator.imageAltBody),
      this.controller.updateImageAlt,
    );

    return router;
  }
}
