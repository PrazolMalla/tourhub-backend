import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { HttpError, NotFoundError } from "../../core/errors";
import type { TeamMemberService } from "./team-member.service";

export class TeamMemberController extends BaseController {
  constructor(private readonly teamMembers: TeamMemberService) {
    super();
  }
  uploadImage = asyncHandler(async (req, res) => {
    const id = this.requireParam(req, "id");

    if (!req.file) {
      throw HttpError.badRequest("Image is required");
    }

    const data = await this.teamMembers.uploadImage(id, req.file);

    return this.ok(res, data);
  });

  removeImage = asyncHandler(async (req, res) => {
    const id = this.requireParam(req, "id");

    const data = await this.teamMembers.removeImage(id);

    return this.ok(res, data);
  });
  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) {
      throw new Error("PaginationMiddleware must run first");
    }

    const { data, meta } = await this.teamMembers.list(req.pagination);

    return this.ok(res, data, meta);
  });

  publicList = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) {
      throw new Error("PaginationMiddleware must run first");
    }

    const { data, meta } = await this.teamMembers.list(req.pagination, { state: "live" });

    return this.ok(res, data, meta);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.teamMembers.findById(this.requireParam(req, "id"));

    return this.ok(res, data);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.teamMembers.create(req.body);

    return this.created(res, data);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");

    const data = await this.teamMembers.update(id, req.body);

    return this.ok(res, data);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");

    await this.teamMembers.hardDelete(id);

    return this.noContent(res);
  });

  private requireParam(req: Request, name: string): string {
    const value = req.params[name];

    if (typeof value !== "string") {
      throw new NotFoundError(`Missing ${name}`);
    }

    return value;
  }
}
