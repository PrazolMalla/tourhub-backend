import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { HttpError, NotFoundError } from "../../core/errors";
import type { HolidayService } from "./holiday.service";

export class HolidayController extends BaseController {
  constructor(private readonly holidays: HolidayService) {
    super();
  }

  // ── Public ──────────────────────────────────────────────────────
  publicList = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    // ?region=everest&region=annapurna → filter; ?search=… handled via pagination.
    const regionQ = req.query.region;
    const regions = Array.isArray(regionQ) ? regionQ.map(String) : regionQ ? [String(regionQ)] : [];
    const { data, meta } = await this.holidays.listPublic(req.pagination, { regions });
    return this.ok(res, data, meta);
  });

  publicBySlug = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.holidays.findPublicBySlug(this.requireParam(req, "slug"));
    return this.ok(res, data);
  });

  // ── Staff ───────────────────────────────────────────────────────
  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const q = req.query.state;
    const state = q === "archived" || q === "all" ? q : "live";
    const { data, meta } = await this.holidays.list(req.pagination, state);
    return this.ok(res, data, meta);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.holidays.findById(this.requireParam(req, "id"));
    return this.ok(res, data);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.holidays.create(req.body);
    return this.created(res, data);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.holidays.update(id, req.body);
    return this.ok(res, data);
  });

  archive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.holidays.archive(id);
    return this.ok(res, data);
  });

  unarchive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.holidays.unarchive(id);
    return this.ok(res, data);
  });

  uploadImage = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const file = req.file;
    if (!file) throw HttpError.badRequest("Image file is required (field: image)");
    const data = await this.holidays.uploadImage(id, file);
    return this.ok(res, data);
  });

  removeImage = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.holidays.removeImage(id);
    return this.ok(res, data);
  });

  updateImageAlt = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const { alt } = req.body as { alt: string };
    const data = await this.holidays.updateImageAlt(id, alt);
    return this.ok(res, data);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    await this.holidays.hardDelete(id);
    return this.noContent(res);
  });

  private requireParam(req: Request, name: string): string {
    const v = req.params[name];
    if (typeof v !== "string") throw new NotFoundError(`Missing ${name}`);
    return v;
  }
}
