import { Router } from "express";
import type { TestimonialController } from "./testimonial.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { PaginationMiddleware } from "../../core/middlewares/pagination.middleware";
import { publicCache } from "../../core/middlewares/cache-control.middleware";
import { AppConstants } from "../../constants";
import { TestimonialValidator } from "./testimonial.validator";
import { uploaderFor, videoUploaderFor } from "../../core/utils/uploads";

export class TestimonialRoutes {
  constructor(private readonly controller: TestimonialController) {}

  getRouter(): Router {
    const router = Router();
    const upload = uploaderFor("testimonial", 1);
    const uploadVideo = videoUploaderFor("testimonial", 1);

    const pagination = PaginationMiddleware.create({
      allowedSortFields: ["createdAt", "sortOrder", "rating", "name"],
      defaultSortBy: "sortOrder",
      defaultSortOrder: "asc",
    });

    // Public read — active testimonials, short cache with SWR.
    router.get(
      "/public",
      publicCache({ maxAge: 30, sMaxAge: 120, staleWhileRevalidate: 300 }),
      pagination,
      this.controller.publicList,
    );

    // Staff endpoints
    router.use(AuthMiddleware.create());
    router.use(AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES));

    router.get("/", pagination, this.controller.list);

    router.get(
      "/:id",
      ValidateMiddleware.params(TestimonialValidator.idParam),
      this.controller.getById,
    );

    router.post("/", ValidateMiddleware.body(TestimonialValidator.create), this.controller.create);

    router.patch(
      "/:id",
      ValidateMiddleware.params(TestimonialValidator.idParam),
      ValidateMiddleware.body(TestimonialValidator.update),
      this.controller.update,
    );

    router.post(
      "/:id/archive",
      ValidateMiddleware.params(TestimonialValidator.idParam),
      this.controller.archive,
    );

    router.post(
      "/:id/unarchive",
      ValidateMiddleware.params(TestimonialValidator.idParam),
      this.controller.unarchive,
    );

    router.delete(
      "/:id",
      ValidateMiddleware.params(TestimonialValidator.idParam),
      this.controller.delete,
    );

    router.post(
      "/:id/image",
      ValidateMiddleware.params(TestimonialValidator.idParam),
      upload.single("image"),
      this.controller.uploadImage,
    );

    router.delete(
      "/:id/image",
      ValidateMiddleware.params(TestimonialValidator.idParam),
      this.controller.removeImage,
    );

    router.post(
      "/:id/video",
      ValidateMiddleware.params(TestimonialValidator.idParam),
      uploadVideo.single("video"),
      this.controller.uploadVideo,
    );

    router.delete(
      "/:id/video",
      ValidateMiddleware.params(TestimonialValidator.idParam),
      this.controller.removeVideo,
    );

    return router;
  }
}
