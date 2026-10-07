import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { NotFoundError } from "../../core/errors";
import type { EnquiryService, EnquiryListFilters } from "./enquiry.service";
import type { EnquiryStatus } from "./enquiry.model";

const STATUSES: readonly EnquiryStatus[] = ["new", "contacted", "converted", "closed", "spam"];

export class EnquiryController extends BaseController {
  constructor(private readonly enquiries: EnquiryService) {
    super();
  }

  // PUBLIC — lead capture. Only a bare success message goes back to the
  // caller; internal fields (id, status, email-delivery flags, etc.) are
  // for the staff inbox, not the public form.
  create = asyncHandler(async (req: Request, res: Response) => {
    const userAgent = req.headers["user-agent"];
    await this.enquiries.create(req.body, {
      ...(req.ip && { ip: req.ip }),
      ...(typeof userAgent === "string" && { userAgent }),
    });
    return this.created(res, { message: "Enquiry submitted successfully" });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const filters: EnquiryListFilters = {};
    const status = req.query.status;
    if (typeof status === "string" && (STATUSES as string[]).includes(status)) {
      filters.status = status as EnquiryStatus;
    }
    if (typeof req.query.source === "string") filters.source = req.query.source;
    if (req.query.isRead === "true") filters.isRead = true;
    else if (req.query.isRead === "false") filters.isRead = false;
    const state = req.query.state;
    filters.state = state === "all" ? state : "live";
    const { data, meta } = await this.enquiries.list(req.pagination, filters);
    return this.ok(res, data, meta);
  });

  unreadCount = asyncHandler(async (_req: Request, res: Response) => {
    const count = await this.enquiries.unreadCount();
    return this.ok(res, { count });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.enquiries.findById(this.requireParam(req, "id"));
    return this.ok(res, data);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    const data = await this.enquiries.update(id, req.body, req.user?.id);
    return this.ok(res, data);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = this.requireParam(req, "id");
    await this.enquiries.hardDelete(id);
    return this.noContent(res);
  });

  private requireParam(req: Request, name: string): string {
    const v = req.params[name];
    if (typeof v !== "string") throw new NotFoundError(`Missing ${name}`);
    return v;
  }
}
