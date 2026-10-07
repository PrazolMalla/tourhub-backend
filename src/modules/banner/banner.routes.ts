import { Router } from "express";
import type { BannerController } from "./banner.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { publicCache } from "../../core/middlewares/cache-control.middleware";
import { AppConstants } from "../../constants";
import { BannerValidator } from "./banner.validator";
import { bufferUploaderFor } from "../../core/utils/uploads";

/**
 * Banners can land in different Cloudinary subfolders depending on
 * `section` (landing/about/products/contact/gallery), which body validation
 * only confirms *after* multer has already parsed the file — so we can't
 * pick the right upload destination in a per-kind `CloudinaryUploadStorage`
 * here. Instead multer just buffers the file in memory (no Cloudinary call
 * yet); the service uploads it explicitly once `section` is known-good.
 */
export class BannerRoutes {
  constructor(private readonly controller: BannerController) {}

  getRouter(): Router {
    const router = Router();
    // In-memory buffer only — the service uploads to Cloudinary once the
    // validated `section` tells it the correct destination folder.
    const upload = bufferUploaderFor(1);

    // Public reads (no auth) — cache at the edge / Next data cache. Same
    // cadence as site-content so banner + hero copy invalidate together.
    router.get(
      "/public/:section",
      publicCache({ maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 600 }),
      ValidateMiddleware.params(BannerValidator.sectionParam),
      this.controller.publicListBySection,
    );

    // Reject non-GET on /public/:section with 405 rather than letting the
    // request fall through to the auth-protected routes below (which would
    // return a misleading 401).
    router.all("/public/:section", (_req, res) => {
      res.set("Allow", "GET");
      res.status(405).json({
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Only GET is allowed on this resource" },
      });
    });

    // 404 for /public with no section instead of falling through to the
    // admin auth middleware (which would otherwise reply 401 and leak
    // module existence to anonymous probes).
    router.all("/public", (_req, res) => {
      res
        .status(404)
        .json({ success: false, error: { code: "NOT_FOUND", message: "Section is required" } });
    });
    router.all("/public/", (_req, res) => {
      res
        .status(404)
        .json({ success: false, error: { code: "NOT_FOUND", message: "Section is required" } });
    });

    // Authenticated admin/superadmin endpoints
    router.use(AuthMiddleware.create());
    router.use(AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES));

    router.get("/", ValidateMiddleware.query(BannerValidator.listQuery), this.controller.adminList);

    router.get("/:id", ValidateMiddleware.params(BannerValidator.idParam), this.controller.getById);

    router.post(
      "/",
      upload.single("image"),
      ValidateMiddleware.body(BannerValidator.create),
      this.controller.create,
    );

    router.patch(
      "/:id",
      ValidateMiddleware.params(BannerValidator.idParam),
      upload.single("image"),
      ValidateMiddleware.body(BannerValidator.update),
      this.controller.update,
    );

    router.post(
      "/:id/archive",
      ValidateMiddleware.params(BannerValidator.idParam),
      this.controller.archive,
    );

    router.post(
      "/:id/unarchive",
      ValidateMiddleware.params(BannerValidator.idParam),
      this.controller.unarchive,
    );

    router.delete(
      "/:id",
      ValidateMiddleware.params(BannerValidator.idParam),
      this.controller.hardDelete,
    );

    return router;
  }
}
