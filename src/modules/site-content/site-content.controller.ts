import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { HttpError, NotFoundError } from "../../core/errors";
import type { SiteContentService } from "./site-content.service";
import { siteFileToImage } from "./site-content.upload";

export class SiteContentController extends BaseController {
  constructor(private readonly content: SiteContentService) {
    super();
  }

  // Public reads
  getPublic = asyncHandler(async (req: Request, res: Response) => {
    return this.ok(res, await this.content.getPublic(this.section(req)));
  });

  listPublic = asyncHandler(async (_req: Request, res: Response) => {
    return this.ok(res, await this.content.listAllPublic());
  });

  // Admin reads
  getAdmin = asyncHandler(async (req: Request, res: Response) => {
    return this.ok(res, await this.content.getAdmin(this.section(req)));
  });

  listAdmin = asyncHandler(async (_req: Request, res: Response) => {
    return this.ok(res, await this.content.listAllAdmin());
  });

  upsert = asyncHandler(async (req: Request, res: Response) => {
    const section = this.section(req);
    const data = await this.content.upsert(section, req.body);
    return this.ok(res, data);
  });

  uploadImages = asyncHandler(async (req: Request, res: Response) => {
    const section = this.section(req);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw HttpError.badRequest("No images uploaded");
    const records = files.map((f) => {
      const rec = siteFileToImage(f);
      return { path: rec.publicId, url: rec.url, mimeType: rec.mimeType, sizeBytes: rec.sizeBytes };
    });
    const data = await this.content.addImages(section, records);
    return this.created(res, data);
  });

  reorderImages = asyncHandler(async (req: Request, res: Response) => {
    const section = this.section(req);
    const { order } = req.body as { order: string[] };
    return this.ok(res, await this.content.reorderImages(section, order));
  });

  updateImageMeta = asyncHandler(async (req: Request, res: Response) => {
    const section = this.section(req);
    const { imagePath, alt, caption } = req.body as {
      imagePath: string;
      alt?: string;
      caption?: string;
    };
    const meta: { alt?: string; caption?: string } = {};
    if (alt !== undefined) meta.alt = alt;
    if (caption !== undefined) meta.caption = caption;
    return this.ok(res, await this.content.updateImageMeta(section, imagePath, meta));
  });

  archive = asyncHandler(async (req: Request, res: Response) => {
    const section = this.section(req);
    const data = await this.content.archive(section);
    return this.ok(res, data);
  });

  unarchive = asyncHandler(async (req: Request, res: Response) => {
    const section = this.section(req);
    return this.ok(res, await this.content.unarchive(section));
  });

  hardDelete = asyncHandler(async (req: Request, res: Response) => {
    const section = this.section(req);
    await this.content.hardDelete(section);
    return this.noContent(res);
  });

  removeImage = asyncHandler(async (req: Request, res: Response) => {
    const section = this.section(req);
    const { imagePath } = req.body as { imagePath: string };
    const data = await this.content.removeImage(section, imagePath);
    return this.ok(res, data);
  });

  private section(req: Request): string {
    const s = req.params.section;
    if (typeof s !== "string") throw new NotFoundError("Missing section");
    return s.toLowerCase();
  }
}
