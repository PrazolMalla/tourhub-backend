import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { HttpError, NotFoundError } from "../../core/errors";
import type { TestimonialService } from "./testimonial.service";

export class TestimonialController extends BaseController {
  constructor(private readonly testimonials: TestimonialService) {
    super();
  }

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const q = req.query.state;
    const state = q === "archived" || q === "all" ? q : "live";
    const { data, meta } = await this.testimonials.list(req.pagination, state);
    return this.ok(res, data, meta);
  });

  publicList = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const { data, meta } = await this.testimonials.listPublic(req.pagination);
    return this.ok(res, data, meta);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.testimonials.findById(this.requireParam(req, "id"));
    return this.ok(res, data);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.testimonials.create(req.body);
    return this.created(res, data);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.testimonials.update(id, req.body);
    return this.ok(res, data);
  });

  archive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.testimonials.archive(id);
    return this.ok(res, data);
  });

  unarchive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.testimonials.unarchive(id);
    return this.ok(res, data);
  });

  uploadImage = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const file = req.file;
    if (!file) throw HttpError.badRequest("Image file is required (field: image)");
    const data = await this.testimonials.uploadImage(id, file);
    return this.ok(res, data);
  });

  removeImage = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.testimonials.removeImage(id);
    return this.ok(res, data);
  });

  uploadVideo = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const file = req.file;
    if (!file) throw HttpError.badRequest("Video file is required (field: video)");
    const data = await this.testimonials.uploadVideo(id, file);
    return this.ok(res, data);
  });

  removeVideo = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.testimonials.removeVideo(id);
    return this.ok(res, data);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    await this.testimonials.hardDelete(id);
    return this.noContent(res);
  });

  private requireParam(req: Request, name: string): string {
    const v = req.params[name];
    if (typeof v !== "string") throw new NotFoundError(`Missing ${name}`);
    return v;
  }
}
