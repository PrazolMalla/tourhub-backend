import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { HttpError, NotFoundError } from "../../core/errors";
import type { TripService } from "./trip.service";
import { fileToRecord, hardDeleteFile } from "../../core/utils/uploads";

export class TripController extends BaseController {
  constructor(private readonly trips: TripService) {
    super();
  }

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const filters: Parameters<TripService["list"]>[1] = {};
    const q = req.query;
    if (q.kind === "trek" || q.kind === "tour") filters.kind = q.kind;
    if (typeof q.country === "string") filters.country = q.country;
    if (typeof q.region === "string") filters.region = q.region;
    if (typeof q.cat === "string") filters.cat = q.cat;
    if (typeof q.isActive === "string") filters.isActive = q.isActive === "true";
    if (q.state === "live" || q.state === "archived" || q.state === "all") {
      filters.state = q.state;
    }
    const { data, meta } = await this.trips.list(req.pagination, filters);
    return this.ok(res, data, meta);
  });

  publicList = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const filters: Parameters<TripService["listWithFacets"]>[1] = { isActive: true };
    const q = req.query;
    if (q.kind === "trek" || q.kind === "tour") filters.kind = q.kind;
    if (typeof q.country === "string") filters.country = q.country;
    if (typeof q.region === "string") filters.region = q.region;
    if (typeof q.regions === "string") {
      filters.regions = q.regions
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (typeof q.cat === "string") filters.cat = q.cat;
    if (typeof q.cats === "string") {
      filters.cats = q.cats
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (typeof q.durations === "string") {
      filters.durationBuckets = q.durations
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (typeof q.minDays === "string" && q.minDays !== "") filters.minDays = Number(q.minDays);
    if (typeof q.maxDays === "string" && q.maxDays !== "") filters.maxDays = Number(q.maxDays);
    if (typeof q.minPrice === "string" && q.minPrice !== "") filters.minPrice = Number(q.minPrice);
    if (typeof q.maxPrice === "string" && q.maxPrice !== "") filters.maxPrice = Number(q.maxPrice);
    const { data, meta, facets } = await this.trips.listWithFacets(req.pagination, filters);
    return this.ok(res, data, { ...meta, facets });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    return this.ok(res, await this.trips.findById(this.requireParam(req, "id")));
  });

  getBySlug = asyncHandler(async (req: Request, res: Response) => {
    return this.ok(res, await this.trips.findBySlug(this.requireParam(req, "slug")));
  });

  publicGetById = asyncHandler(async (req: Request, res: Response) => {
    return this.ok(res, await this.trips.findPublishedById(this.requireParam(req, "id")));
  });

  publicGetBySlug = asyncHandler(async (req: Request, res: Response) => {
    return this.ok(res, await this.trips.findPublishedBySlug(this.requireParam(req, "slug")));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.trips.create(req.body, req.user?.id);
    return this.created(res, trip);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const trip = await this.trips.update(id, req.body);
    return this.ok(res, trip);
  });

  archive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const trip = await this.trips.archive(id);
    return this.ok(res, trip);
  });

  unarchive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const trip = await this.trips.unarchive(id);
    return this.ok(res, trip);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    await this.trips.hardDelete(id);
    return this.noContent(res);
  });

  uploadImages = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      throw HttpError.badRequest("No images uploaded");
    }
    const images = files.map((f) => {
      const rec = fileToRecord("trip", f);
      return { path: rec.publicId, url: rec.url, mimeType: rec.mimeType, sizeBytes: rec.sizeBytes };
    });
    try {
      const trip = await this.trips.addImages(id, images);
      return this.ok(res, trip);
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
    const trip = await this.trips.removeImage(id, imagePath);
    return this.ok(res, trip);
  });

  setPrimaryImage = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const imagePath = req.body?.path;
    if (typeof imagePath !== "string") throw HttpError.badRequest("path required");
    return this.ok(res, await this.trips.setPrimaryImage(id, imagePath));
  });

  reorderImages = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const order = req.body?.order;
    if (!Array.isArray(order)) throw HttpError.badRequest("order array required");
    const trip = await this.trips.reorderImages(id, order);
    return this.ok(res, trip);
  });

  updateImageAlt = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const { path, alt } = req.body as { path: string; alt: string };
    const trip = await this.trips.updateImageAlt(id, path, alt);
    return this.ok(res, trip);
  });

  private requireParam(req: Request, name: string): string {
    const v = req.params[name];
    if (typeof v !== "string") throw new NotFoundError(`Missing ${name}`);
    return v;
  }
}
