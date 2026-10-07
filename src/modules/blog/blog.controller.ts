import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { HttpError, NotFoundError } from "../../core/errors";
import type { BlogService } from "./blog.service";
import { fileToRecord, hardDeleteFile } from "../../core/utils/uploads";

export class BlogController extends BaseController {
  constructor(private readonly blogs: BlogService) {
    super();
  }

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const filters: Parameters<BlogService["list"]>[1] = {};
    const q = req.query;
    if (typeof q.category === "string") filters.category = q.category;
    if (typeof q.featured === "string") filters.featured = q.featured === "true";
    if (typeof q.isActive === "string") filters.isActive = q.isActive === "true";
    if (q.state === "live" || q.state === "archived" || q.state === "all") {
      filters.state = q.state;
    }
    const { data, meta } = await this.blogs.list(req.pagination, filters);
    return this.ok(res, data, meta);
  });

  publicList = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const filters: Parameters<BlogService["list"]>[1] = { isActive: true };
    const q = req.query;
    if (typeof q.category === "string") filters.category = q.category;
    if (typeof q.featured === "string") filters.featured = q.featured === "true";
    const { data, meta } = await this.blogs.list(req.pagination, filters);
    return this.ok(res, data, meta);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    return this.ok(res, await this.blogs.findById(this.requireParam(req, "id")));
  });

  getBySlug = asyncHandler(async (req: Request, res: Response) => {
    return this.ok(res, await this.blogs.findBySlug(this.requireParam(req, "slug")));
  });

  publicGetById = asyncHandler(async (req: Request, res: Response) => {
    return this.ok(res, await this.blogs.findPublishedById(this.requireParam(req, "id")));
  });

  publicGetBySlug = asyncHandler(async (req: Request, res: Response) => {
    return this.ok(res, await this.blogs.findPublishedBySlug(this.requireParam(req, "slug")));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const blog = await this.blogs.create(req.body, req.user?.id);
    return this.created(res, blog);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const blog = await this.blogs.update(id, req.body);
    return this.ok(res, blog);
  });

  archive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const blog = await this.blogs.archive(id);
    return this.ok(res, blog);
  });

  unarchive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const blog = await this.blogs.unarchive(id);
    return this.ok(res, blog);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    await this.blogs.hardDelete(id);
    return this.noContent(res);
  });

  uploadImages = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      throw HttpError.badRequest("No images uploaded");
    }
    const images = files.map((f) => {
      const rec = fileToRecord("blog", f);
      return { path: rec.publicId, url: rec.url, mimeType: rec.mimeType, sizeBytes: rec.sizeBytes };
    });
    try {
      const blog = await this.blogs.addImages(id, images);
      return this.ok(res, blog);
    } catch (err) {
      // Roll back any newly uploaded Cloudinary assets if the DB write failed
      for (const img of images) await hardDeleteFile(img.path, "image");
      throw err;
    }
  });

  removeImage = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const imagePath = req.body?.path;
    if (typeof imagePath !== "string") throw HttpError.badRequest("path required");
    const blog = await this.blogs.removeImage(id, imagePath);
    return this.ok(res, blog);
  });

  setPrimaryImage = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const imagePath = req.body?.path;
    if (typeof imagePath !== "string") throw HttpError.badRequest("path required");
    return this.ok(res, await this.blogs.setPrimaryImage(id, imagePath));
  });

  updateImageAlt = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const { path, alt } = req.body as { path: string; alt: string };
    const blog = await this.blogs.updateImageAlt(id, path, alt);
    return this.ok(res, blog);
  });

  private requireParam(req: Request, name: string): string {
    const v = req.params[name];
    if (typeof v !== "string") throw new NotFoundError(`Missing ${name}`);
    return v;
  }
}
