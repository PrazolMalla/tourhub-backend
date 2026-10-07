import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { HttpError, NotFoundError } from "../../core/errors";
import { fileToRecord, hardDeleteFile } from "../../core/utils/uploads";
import type { SeoService } from "./seo.service";
import type { SeoEntityType } from "./seo.model";

export class SeoController extends BaseController {
  constructor(private readonly seo: SeoService) {
    super();
  }

  private entity(req: Request): { entityType: SeoEntityType; entityId: string } {
    const entityType = req.params.entityType as SeoEntityType | undefined;
    const entityId = req.params.entityId;
    if (!entityType || typeof entityId !== "string") {
      throw new NotFoundError("Missing entityType/entityId");
    }
    return { entityType, entityId };
  }

  // ── Public ──────────────────────────────────────────────────────────────
  getPublic = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = this.entity(req);
    return this.ok(res, await this.seo.getPublic(entityType, entityId));
  });

  listPublic = asyncHandler(async (req: Request, res: Response) => {
    const entityType = req.query.entityType as SeoEntityType | undefined;
    return this.ok(res, await this.seo.listPublicByEntityType(entityType));
  });

  // ── Admin ───────────────────────────────────────────────────────────────
  getAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = this.entity(req);
    return this.ok(res, await this.seo.getAdmin(entityType, entityId));
  });

  listAdmin = asyncHandler(async (req: Request, res: Response) => {
    const entityType = req.query.entityType as SeoEntityType | undefined;
    return this.ok(res, await this.seo.listAdmin(entityType));
  });

  upsert = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = this.entity(req);
    return this.ok(res, await this.seo.upsert(entityType, entityId, req.body));
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = this.entity(req);
    await this.seo.delete(entityType, entityId);
    return this.noContent(res);
  });

  uploadOgImage = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = this.entity(req);
    const file = req.file;
    if (!file) throw HttpError.badRequest("No image uploaded");
    const rec = fileToRecord("seo", file);
    const alt = typeof req.body?.alt === "string" ? req.body.alt : undefined;
    try {
      const data = await this.seo.setOgImage(entityType, entityId, {
        url: rec.url,
        path: rec.publicId,
        ...(alt !== undefined && { alt }),
      });
      return this.ok(res, data);
    } catch (err) {
      await hardDeleteFile(rec.publicId, "image");
      throw err;
    }
  });

  removeOgImage = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = this.entity(req);
    return this.ok(res, await this.seo.removeOgImage(entityType, entityId));
  });

  updateOgImageAlt = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = this.entity(req);
    const alt = typeof req.body?.alt === "string" ? req.body.alt : "";
    return this.ok(res, await this.seo.updateOgImageAlt(entityType, entityId, alt));
  });

  uploadTwitterImage = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = this.entity(req);
    const file = req.file;
    if (!file) throw HttpError.badRequest("No image uploaded");
    const rec = fileToRecord("seo", file);
    const alt = typeof req.body?.alt === "string" ? req.body.alt : undefined;
    try {
      const data = await this.seo.setTwitterImage(entityType, entityId, {
        url: rec.url,
        path: rec.publicId,
        ...(alt !== undefined && { alt }),
      });
      return this.ok(res, data);
    } catch (err) {
      await hardDeleteFile(rec.publicId, "image");
      throw err;
    }
  });

  removeTwitterImage = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = this.entity(req);
    return this.ok(res, await this.seo.removeTwitterImage(entityType, entityId));
  });

  updateTwitterImageAlt = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = this.entity(req);
    const alt = typeof req.body?.alt === "string" ? req.body.alt : "";
    return this.ok(res, await this.seo.updateTwitterImageAlt(entityType, entityId, alt));
  });
}
