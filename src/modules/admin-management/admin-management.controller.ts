import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { NotFoundError, UnauthorizedError } from "../../core/errors";
import type { AdminManagementService } from "./admin-management.service";

export class AdminManagementController extends BaseController {
  constructor(private readonly svc: AdminManagementService) {
    super();
  }

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) throw new Error("PaginationMiddleware must run first");
    const { data, meta } = await this.svc.listAdmins(req.pagination);
    return this.ok(res, data, meta);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const admin = await this.svc.createAdmin(req.body);
    return this.created(res, admin);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = this.idParam(req);
    const admin = await this.svc.updateAdmin(id, req.body);
    return this.ok(res, admin);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = this.idParam(req);
    await this.svc.deleteAdmin(id);
    return this.noContent(res);
  });

  ban = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new UnauthorizedError("Not authenticated");
    const id = this.idParam(req);
    const reason = (req.body as { reason?: string }).reason;
    const updated = await this.svc.setBanned(id, true, reason, req.user.id);
    return this.ok(res, updated);
  });

  clearDatabase = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new UnauthorizedError("Not authenticated");
    const { confirmationCode } = req.body as { confirmationCode: string };
    const result = await this.svc.clearDatabase(confirmationCode);
    // Audit happens after the wipe (the audit collection was just dropped and
    // recreated by the seeder), so this row is the first entry in the fresh
    // log — the only durable record that the reset ran.
    return this.ok(res, result);
  });

  unban = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new UnauthorizedError("Not authenticated");
    const id = this.idParam(req);
    const updated = await this.svc.setBanned(id, false, undefined, req.user.id);
    return this.ok(res, updated);
  });

  private idParam(req: Request): string {
    const id = req.params.id;
    if (typeof id !== "string") throw new NotFoundError("Missing id");
    return id;
  }
}
