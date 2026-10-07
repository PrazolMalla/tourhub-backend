import { Router } from "express";
import type { BlogController } from "./blog.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { PaginationMiddleware } from "../../core/middlewares/pagination.middleware";
import { publicCache } from "../../core/middlewares/cache-control.middleware";
import { AppConstants } from "../../constants";
import { BlogValidator } from "./blog.validator";
import { uploaderFor } from "../../core/utils/uploads";

export class BlogRoutes {
  constructor(private readonly controller: BlogController) {}

  getRouter(): Router {
    const router = Router();
    const upload = uploaderFor("blog", 10);

    const publicPagination = PaginationMiddleware.create({
      allowedSortFields: ["datePublished", "createdAt", "title"],
      defaultSortBy: "datePublished",
      defaultSortOrder: "desc",
    });

    // Public reads — short cache with SWR keeps the blog index snappy while
    // still picking up newly published / edited articles quickly.
    const publicBlogCache = publicCache({ maxAge: 30, sMaxAge: 120, staleWhileRevalidate: 300 });
    router.get("/public", publicBlogCache, publicPagination, this.controller.publicList);
    router.get(
      "/public/slug/:slug",
      publicBlogCache,
      ValidateMiddleware.params(BlogValidator.slugParam),
      this.controller.publicGetBySlug,
    );
    router.get(
      "/public/:id",
      publicBlogCache,
      ValidateMiddleware.params(BlogValidator.idParam),
      this.controller.publicGetById,
    );

    // Staff endpoints
    router.use(AuthMiddleware.create());
    router.use(AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES));

    router.get(
      "/",
      PaginationMiddleware.create({
        allowedSortFields: ["datePublished", "createdAt", "title"],
        defaultSortBy: "createdAt",
        defaultSortOrder: "desc",
      }),
      this.controller.list,
    );

    router.get("/:id", ValidateMiddleware.params(BlogValidator.idParam), this.controller.getById);

    router.post("/", ValidateMiddleware.body(BlogValidator.create), this.controller.create);

    router.patch(
      "/:id",
      ValidateMiddleware.params(BlogValidator.idParam),
      ValidateMiddleware.body(BlogValidator.update),
      this.controller.update,
    );

    router.post(
      "/:id/archive",
      ValidateMiddleware.params(BlogValidator.idParam),
      this.controller.archive,
    );

    router.post(
      "/:id/unarchive",
      ValidateMiddleware.params(BlogValidator.idParam),
      this.controller.unarchive,
    );

    router.delete("/:id", ValidateMiddleware.params(BlogValidator.idParam), this.controller.delete);

    router.post(
      "/:id/images",
      ValidateMiddleware.params(BlogValidator.idParam),
      upload.array("images", 10),
      this.controller.uploadImages,
    );

    router.delete(
      "/:id/images",
      ValidateMiddleware.params(BlogValidator.idParam),
      ValidateMiddleware.body(BlogValidator.imagePathBody),
      this.controller.removeImage,
    );

    router.post(
      "/:id/images/primary",
      ValidateMiddleware.params(BlogValidator.idParam),
      ValidateMiddleware.body(BlogValidator.imagePathBody),
      this.controller.setPrimaryImage,
    );

    router.patch(
      "/:id/images/meta",
      ValidateMiddleware.params(BlogValidator.idParam),
      ValidateMiddleware.body(BlogValidator.imageMetaBody),
      this.controller.updateImageAlt,
    );

    return router;
  }
}
