import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { NotFoundError, UnauthorizedError } from "../../core/errors";
import type { UserService } from "./user.service";

export class UserController extends BaseController {
  constructor(private readonly userService: UserService) {
    super();
  }

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.pagination) {
      throw new Error("PaginationMiddleware must run before UserController.list");
    }
    const { data, meta } = await this.userService.list(req.pagination);
    return this.ok(res, data, meta);
  });

  getMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new UnauthorizedError("Not authenticated");
    const user = await this.userService.getCurrentUser(req.user.id);
    return this.ok(res, user);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.userService.findById(this.requireIdParam(req));
    return this.ok(res, user);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.userService.update(this.requireIdParam(req), req.body);
    return this.ok(res, user);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.userService.delete(this.requireIdParam(req));
    return this.noContent(res);
  });

  ban = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new UnauthorizedError("Not authenticated");
    const id = this.requireIdParam(req);
    const reason = (req.body as { reason?: string }).reason;
    const updated = await this.userService.setBanned(id, true, reason, req.user.id);
    return this.ok(res, updated);
  });

  unban = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new UnauthorizedError("Not authenticated");
    const id = this.requireIdParam(req);
    const updated = await this.userService.setBanned(id, false, undefined, req.user.id);
    return this.ok(res, updated);
  });

  private requireIdParam(req: Request): string {
    const id = req.params.id;
    if (typeof id !== "string") throw new NotFoundError("Missing id");
    return id;
  }
}
