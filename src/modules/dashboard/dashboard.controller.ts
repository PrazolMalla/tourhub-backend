import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import type { DashboardService, DashboardRange } from "./dashboard.service";

const ALLOWED_RANGES: ReadonlyArray<DashboardRange> = ["7d", "30d", "90d", "all"];

function pickRange(value: unknown): DashboardRange {
  if (typeof value === "string" && (ALLOWED_RANGES as readonly string[]).includes(value)) {
    return value as DashboardRange;
  }
  return "30d";
}

export class DashboardController extends BaseController {
  constructor(private readonly svc: DashboardService) {
    super();
  }

  summary = asyncHandler(async (req: Request, res: Response) => {
    const range = pickRange(req.query.range);
    const data = await this.svc.summary(range);
    return this.ok(res, data);
  });
}
