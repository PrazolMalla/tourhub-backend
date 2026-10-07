import { Router } from "express";
import type { SeoController } from "./seo.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { publicCache } from "../../core/middlewares/cache-control.middleware";
import { AppConstants } from "../../constants";
import { SeoValidator } from "./seo.validator";
import { uploaderFor } from "../../core/utils/uploads";

export class SeoRoutes {
  constructor(private readonly controller: SeoController) {}

  getRouter(): Router {
    const router = Router();
    const upload = uploaderFor("seo", 1);

    // ── Public reads (no auth) ─────────────────────────────────────────────
    // SEO is admin-edited rarely — cache long at the edge, short in the
    // browser, same shape as site-content's public cache.
    const publicSeoCache = publicCache({ maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 600 });
    router.get(
      "/public",
      publicSeoCache,
      ValidateMiddleware.query(SeoValidator.listQuery),
      this.controller.listPublic,
    );
    router.get(
      "/public/:entityType/:entityId",
      publicSeoCache,
      ValidateMiddleware.params(SeoValidator.entityParam),
      this.controller.getPublic,
    );

    // ── Authenticated (staff) ───────────────────────────────────────────────
    router.use(AuthMiddleware.create());
    router.use(AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES));

    router.get("/", ValidateMiddleware.query(SeoValidator.listQuery), this.controller.listAdmin);

    router.get(
      "/:entityType/:entityId",
      ValidateMiddleware.params(SeoValidator.entityParam),
      this.controller.getAdmin,
    );

    router.put(
      "/:entityType/:entityId",
      ValidateMiddleware.params(SeoValidator.entityParam),
      ValidateMiddleware.body(SeoValidator.upsert),
      this.controller.upsert,
    );

    router.delete(
      "/:entityType/:entityId",
      ValidateMiddleware.params(SeoValidator.entityParam),
      this.controller.delete,
    );

    router.post(
      "/:entityType/:entityId/og-image",
      ValidateMiddleware.params(SeoValidator.entityParam),
      upload.single("image"),
      this.controller.uploadOgImage,
    );
    router.delete(
      "/:entityType/:entityId/og-image",
      ValidateMiddleware.params(SeoValidator.entityParam),
      this.controller.removeOgImage,
    );
    router.patch(
      "/:entityType/:entityId/og-image/alt",
      ValidateMiddleware.params(SeoValidator.entityParam),
      ValidateMiddleware.body(SeoValidator.imageAlt),
      this.controller.updateOgImageAlt,
    );

    router.post(
      "/:entityType/:entityId/twitter-image",
      ValidateMiddleware.params(SeoValidator.entityParam),
      upload.single("image"),
      this.controller.uploadTwitterImage,
    );
    router.delete(
      "/:entityType/:entityId/twitter-image",
      ValidateMiddleware.params(SeoValidator.entityParam),
      this.controller.removeTwitterImage,
    );
    router.patch(
      "/:entityType/:entityId/twitter-image/alt",
      ValidateMiddleware.params(SeoValidator.entityParam),
      ValidateMiddleware.body(SeoValidator.imageAlt),
      this.controller.updateTwitterImageAlt,
    );

    return router;
  }
}
