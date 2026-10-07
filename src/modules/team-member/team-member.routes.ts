import { Router } from "express";
import type { TeamMemberController } from "./team-member.controller";
import { AuthMiddleware } from "../../core/middlewares/auth.middleware";
import { AuthorizeMiddleware } from "../../core/middlewares/authorize.middleware";
import { ValidateMiddleware } from "../../core/middlewares/validate.middleware";
import { PaginationMiddleware } from "../../core/middlewares/pagination.middleware";
import { publicCache } from "../../core/middlewares/cache-control.middleware";
import { AppConstants } from "../../constants";
import { TeamMemberValidator } from "./team-member.validator";
import { uploaderFor } from "@core/utils/uploads";

export class TeamMemberRoutes {
  constructor(private readonly controller: TeamMemberController) {}

  getRouter(): Router {
    const router = Router();

    const pagination = PaginationMiddleware.create({
      allowedSortFields: ["createdAt", "name", "role", "location"],
      defaultSortBy: "createdAt",
      defaultSortOrder: "desc",
    });

    // Public read — active team members, lightly cached. Used by the About page.
    router.get("/public", publicCache(), pagination, this.controller.publicList);

    router.use(AuthMiddleware.create());
    router.use(AuthorizeMiddleware.roles(...AppConstants.STAFF_ROLES));

    // List team members
    router.get("/", pagination, this.controller.list);

    // Get team member by ID
    router.get(
      "/:id",
      ValidateMiddleware.params(TeamMemberValidator.idParam),
      this.controller.getById,
    );
    const upload = uploaderFor("team-member", 1);
    // Create team member (photo is attached afterward via POST /:id/image)
    router.post("/", ValidateMiddleware.body(TeamMemberValidator.create), this.controller.create);

    // Update team member
    router.patch(
      "/:id",
      ValidateMiddleware.params(TeamMemberValidator.idParam),
      ValidateMiddleware.body(TeamMemberValidator.update),
      this.controller.update,
    );

    // Delete team member
    router.delete(
      "/:id",
      ValidateMiddleware.params(TeamMemberValidator.idParam),
      this.controller.delete,
    );
    router.post(
      "/:id/image",
      ValidateMiddleware.params(TeamMemberValidator.idParam),
      upload.single("image"),
      this.controller.uploadImage,
    );

    router.delete(
      "/:id/image",
      ValidateMiddleware.params(TeamMemberValidator.idParam),
      this.controller.removeImage,
    );
    return router;
  }
}
