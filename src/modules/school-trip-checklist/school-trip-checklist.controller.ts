import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { HttpError, NotFoundError } from "../../core/errors";
import { getClientIp } from "../security/client-ip.util";
import { lookupGeo } from "../../core/utils/geo.util";
import type { SchoolTripChecklistService } from "./school-trip-checklist.service";
import type { ChecklistDownloadStatus } from "./checklist-download-log.model";

export class SchoolTripChecklistController extends BaseController {
  constructor(private readonly checklists: SchoolTripChecklistService) {
    super();
  }

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const q = req.query.state;
    const state = q === "archived" || q === "all" ? q : "live";
    const { data, meta } = await this.checklists.list(req.pagination, state);
    return this.ok(res, data, meta);
  });

  publicList = asyncHandler(async (_req: Request, res: Response) => {
    return this.ok(res, await this.checklists.listPublic());
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    return this.ok(res, await this.checklists.findById(this.requireParam(req, "id")));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    const data = await this.checklists.create(req.body, file);
    return this.created(res, data);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.checklists.update(id, req.body);
    return this.ok(res, data);
  });

  uploadPdf = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const file = req.file;
    if (!file) throw HttpError.badRequest("PDF file is required (field: pdf)");
    const data = await this.checklists.uploadPdf(id, file);
    return this.ok(res, data);
  });

  removePdf = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    return this.ok(res, await this.checklists.removePdf(id));
  });

  archive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.checklists.archive(id);
    return this.ok(res, data);
  });

  unarchive = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    return this.ok(res, await this.checklists.unarchive(id));
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    await this.checklists.hardDelete(id);
    return this.noContent(res);
  });

  /**
   * Public — logs the attempt (name/phone/IP-derived location/timestamp,
   * success or failed) and hands back the PDF URL to download on success.
   */
  download = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const ip = getClientIp(req);
    const geoResult = lookupGeo(ip);
    const userAgent =
      typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;

    const result = await this.checklists.recordDownload({
      checklistId: id,
      name: req.body.name,
      phone: req.body.phone,
      geo: { ip, ...geoResult, ...(userAgent && { userAgent }) },
    });

    if (!result) throw new NotFoundError("Checklist not found or unavailable");
    return this.ok(res, result);
  });

  /** Staff-only — the download audit trail (name, phone, timestamp, location, status). */
  listLogs = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const q = req.query.status;
    const status: ChecklistDownloadStatus | undefined =
      q === "success" || q === "failed" ? q : undefined;
    const { data, meta } = await this.checklists.listLogs(req.pagination, status);
    return this.ok(res, data, meta);
  });

  private requireParam(req: Request, name: string): string {
    const v = req.params[name];
    if (typeof v !== "string") throw new NotFoundError(`Missing ${name}`);
    return v;
  }
}
