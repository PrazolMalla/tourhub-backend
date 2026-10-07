import { Router } from "express";
import type { SchoolTripChecklistController } from "./school-trip-checklist.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { PaginationMiddleware } from "../../core/middlewares/pagination.middleware";
import { publicCache } from "../../core/middlewares/cache-control.middleware";
import { AppConstants } from "../../constants";
import { SchoolTripChecklistValidator } from "./school-trip-checklist.validator";
import { documentUploaderFor } from "../../core/utils/uploads";
import { DynamicRateLimitMiddleware } from "../rate-limit-config/dynamic-rate-limit.middleware";

export class SchoolTripChecklistRoutes {
  constructor(private readonly controller: SchoolTripChecklistController) {}

  getRouter(): Router {
    const router = Router();
    const upload = documentUploaderFor("checklist", 1);

    // ── Public reads (no auth) ────────────────────────────────────────────
    router.get("/public", publicCache(), this.controller.publicList);

    // Public — logs the attempt, then hands back the pdfUrl on success.
    // Public form submission — throttled like the enquiry form so the audit
    // log can't be flooded.
    router.post(
      "/:id/download",
      DynamicRateLimitMiddleware.for("enquiry"),
      ValidateMiddleware.params(SchoolTripChecklistValidator.idParam),
      ValidateMiddleware.body(SchoolTripChecklistValidator.download),
      this.controller.download,
    );

    // ── Staff-only ─────────────────────────────────────────────────────────
    router.use(AuthMiddleware.create());
    router.use(AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES));

    // Must come before "/:id" so "logs" isn't parsed as an id.
    router.get(
      "/logs",
      PaginationMiddleware.create({
        allowedSortFields: ["createdAt"],
        defaultSortBy: "createdAt",
        defaultSortOrder: "desc",
      }),
      this.controller.listLogs,
    );

    router.get(
      "/",
      PaginationMiddleware.create({
        allowedSortFields: ["createdAt", "sortOrder", "type"],
        defaultSortBy: "sortOrder",
        defaultSortOrder: "asc",
      }),
      this.controller.list,
    );

    router.get(
      "/:id",
      ValidateMiddleware.params(SchoolTripChecklistValidator.idParam),
      this.controller.getById,
    );

    router.post(
      "/",
      upload.single("pdf"),
      ValidateMiddleware.body(SchoolTripChecklistValidator.create),
      this.controller.create,
    );

    router.patch(
      "/:id",
      ValidateMiddleware.params(SchoolTripChecklistValidator.idParam),
      ValidateMiddleware.body(SchoolTripChecklistValidator.update),
      this.controller.update,
    );

    router.post(
      "/:id/pdf",
      ValidateMiddleware.params(SchoolTripChecklistValidator.idParam),
      upload.single("pdf"),
      this.controller.uploadPdf,
    );

    router.delete(
      "/:id/pdf",
      ValidateMiddleware.params(SchoolTripChecklistValidator.idParam),
      this.controller.removePdf,
    );

    router.post(
      "/:id/archive",
      ValidateMiddleware.params(SchoolTripChecklistValidator.idParam),
      this.controller.archive,
    );

    router.post(
      "/:id/unarchive",
      ValidateMiddleware.params(SchoolTripChecklistValidator.idParam),
      this.controller.unarchive,
    );

    router.delete(
      "/:id",
      ValidateMiddleware.params(SchoolTripChecklistValidator.idParam),
      this.controller.delete,
    );

    return router;
  }
}
