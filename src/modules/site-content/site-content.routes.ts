import { Router } from "express";
import type { SiteContentController } from "./site-content.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { publicCache } from "../../core/middlewares/cache-control.middleware";
import { AppConstants } from "../../constants";
import { SiteContentValidator } from "./site-content.validator";
import { siteContentImageUpload } from "./site-content.upload";

export class SiteContentRoutes {
  constructor(private readonly controller: SiteContentController) {}

  getRouter(): Router {
    const router = Router();

    // ── Public reads (no auth) ────────────────────────────────────────────
    // Site-content is admin-edited a few times a week at most. Cache long at
    // the edge but short in the browser so admin edits feel close-to-live.
    const publicSiteCache = publicCache({ maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 600 });
    router.get("/public", publicSiteCache, this.controller.listPublic);
    router.get(
      "/public/:section",
      publicSiteCache,
      ValidateMiddleware.params(SiteContentValidator.sectionParam),
      this.controller.getPublic,
    );

    // ── Authenticated ─────────────────────────────────────────────────────
    router.use(AuthMiddleware.create());
    router.use(AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES));

    router.get("/", this.controller.listAdmin);
    router.get(
      "/:section",
      ValidateMiddleware.params(SiteContentValidator.sectionParam),
      this.controller.getAdmin,
    );
    router.put(
      "/:section",
      ValidateMiddleware.params(SiteContentValidator.sectionParam),
      ValidateMiddleware.body(SiteContentValidator.upsert),
      this.controller.upsert,
    );

    // Image uploads (multipart — validate AFTER multer parses)
    router.post(
      "/:section/images",
      ValidateMiddleware.params(SiteContentValidator.sectionParam),
      siteContentImageUpload().array("images", 20),
      this.controller.uploadImages,
    );

    router.patch(
      "/:section/images/reorder",
      ValidateMiddleware.params(SiteContentValidator.sectionParam),
      ValidateMiddleware.body(SiteContentValidator.reorder),
      this.controller.reorderImages,
    );

    router.patch(
      "/:section/images/meta",
      ValidateMiddleware.params(SiteContentValidator.sectionParam),
      ValidateMiddleware.body(SiteContentValidator.imageMeta),
      this.controller.updateImageMeta,
    );

    router.delete(
      "/:section/images",
      ValidateMiddleware.params(SiteContentValidator.sectionParam),
      ValidateMiddleware.body(SiteContentValidator.removeImage),
      this.controller.removeImage,
    );

    // Archive / Unarchive / Hard-delete
    router.post(
      "/:section/archive",
      ValidateMiddleware.params(SiteContentValidator.sectionParam),
      this.controller.archive,
    );
    router.post(
      "/:section/unarchive",
      ValidateMiddleware.params(SiteContentValidator.sectionParam),
      this.controller.unarchive,
    );
    router.delete(
      "/:section",
      ValidateMiddleware.params(SiteContentValidator.sectionParam),
      this.controller.hardDelete,
    );

    return router;
  }
}
