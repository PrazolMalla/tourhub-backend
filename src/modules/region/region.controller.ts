import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { HttpError, NotFoundError } from "../../core/errors";
import type { RegionService } from "./region.service";

export class RegionController extends BaseController {
  constructor(private readonly regions: RegionService) {
    super();
  }

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const q = req.query.state;
    const state = q === "archived" || q === "all" ? q : "live";
    const { data, meta } = await this.regions.list(req.pagination, state);
    return this.ok(res, data, meta);
  });

  publicList = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const { data, meta } = await this.regions.listPublic(req.pagination);
    return this.ok(res, data, meta);
  });

  listAll = asyncHandler(async (_req: Request, res: Response) => {
    const data = await this.regions.listAll();
    return this.ok(res, data);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.regions.findById(this.requireParam(req, "id"));
    return this.ok(res, data);
  });

  getBySlug = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.regions.findBySlug(this.requireParam(req, "slug"));
    return this.ok(res, data);
  });

  publicGetById = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.regions.findPublishedById(this.requireParam(req, "id"));
    return this.ok(res, data);
  });

  publicGetBySlug = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.regions.findPublishedBySlug(this.requireParam(req, "slug"));
    return this.ok(res, data);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.regions.create(req.body);
    return this.created(res, data);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.regions.update(id, req.body);
    return this.ok(res, data);
  });

  archive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.regions.archive(id);
    return this.ok(res, data);
  });

  unarchive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.regions.unarchive(id);
    return this.ok(res, data);
  });

  uploadImage = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const file = req.file;
    if (!file) throw HttpError.badRequest("Image file is required (field: image)");
    const data = await this.regions.uploadImage(id, file);
    return this.ok(res, data);
  });

  removeImage = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.regions.removeImage(id);
    return this.ok(res, data);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    await this.regions.hardDelete(id);
    return this.noContent(res);
  });

  private requireParam(req: Request, name: string): string {
    const v = req.params[name];
    if (typeof v !== "string") throw new NotFoundError(`Missing ${name}`);
    return v;
  }
}
