import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { HttpError, NotFoundError } from "../../core/errors";
import type { PartnerService } from "./partner.service";

export class PartnerController extends BaseController {
  constructor(private readonly partners: PartnerService) {
    super();
  }

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const q = req.query.state;
    const state = q === "archived" || q === "all" ? q : "live";
    const { data, meta } = await this.partners.list(req.pagination, state);
    return this.ok(res, data, meta);
  });

  publicList = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const { data, meta } = await this.partners.listPublic(req.pagination);
    return this.ok(res, data, meta);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.partners.findById(this.requireParam(req, "id"));
    return this.ok(res, data);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.partners.create(req.body);
    return this.created(res, data);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.partners.update(id, req.body);
    return this.ok(res, data);
  });

  archive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.partners.archive(id);
    return this.ok(res, data);
  });

  unarchive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.partners.unarchive(id);
    return this.ok(res, data);
  });

  uploadImage = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const file = req.file;
    if (!file) throw HttpError.badRequest("Image file is required (field: image)");
    const data = await this.partners.uploadImage(id, file);
    return this.ok(res, data);
  });

  removeImage = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.partners.removeImage(id);
    return this.ok(res, data);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    await this.partners.hardDelete(id);
    return this.noContent(res);
  });

  private requireParam(req: Request, name: string): string {
    const v = req.params[name];
    if (typeof v !== "string") throw new NotFoundError(`Missing ${name}`);
    return v;
  }
}
