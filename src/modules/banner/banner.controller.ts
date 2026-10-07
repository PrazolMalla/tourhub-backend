import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { NotFoundError } from "../../core/errors";
import type { BannerService } from "./banner.service";
import type { BannerSection } from "./banner.model";
import type { BannerState } from "./banner.repository";

export class BannerController extends BaseController {
  constructor(private readonly banners: BannerService) {
    super();
  }

  publicListBySection = asyncHandler(async (req: Request, res: Response) => {
    return this.ok(res, await this.banners.listPublic(this.sectionParam(req)));
  });

  adminList = asyncHandler(async (req: Request, res: Response) => {
    const section = (req.query.section as BannerSection | undefined) ?? undefined;
    const state = (req.query.state as BannerState | undefined) ?? "live";
    const filters: { section?: BannerSection; state: BannerState } = { state };
    if (section) filters.section = section;
    return this.ok(res, await this.banners.listAdmin(filters));
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    return this.ok(res, await this.banners.findById(this.idParam(req)));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const file = req.file as Express.Multer.File | undefined;
    const banner = await this.banners.create(req.body, file, req.user?.id);
    return this.created(res, banner);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = this.idParam(req);
    const file = req.file as Express.Multer.File | undefined;
    const banner = await this.banners.update(id, req.body, file);
    return this.ok(res, banner);
  });

  archive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.idParam(req);
    const banner = await this.banners.archive(id);
    return this.ok(res, banner);
  });

  unarchive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.idParam(req);
    return this.ok(res, await this.banners.unarchive(id));
  });

  hardDelete = asyncHandler(async (req: Request, res: Response) => {
    const id = this.idParam(req);
    await this.banners.hardDelete(id);
    return this.noContent(res);
  });

  private idParam(req: Request): string {
    const v = req.params.id;
    if (typeof v !== "string") throw new NotFoundError("Missing id");
    return v;
  }

  private sectionParam(req: Request): BannerSection {
    const s = req.params.section;
    if (typeof s !== "string") throw new NotFoundError("Missing section");
    return s as BannerSection;
  }
}
