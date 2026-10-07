import type { Router } from "express";
import { DashboardController } from "./dashboard.controller";
import { DashboardRoutes } from "./dashboard.routes";
import { DashboardService } from "./dashboard.service";

export class DashboardModule {
  private static _service: DashboardService | null = null;

  static service(): DashboardService {
    if (!this._service) {
      this._service = new DashboardService();
    }
    return this._service;
  }

  static create(): Router {
    const controller = new DashboardController(this.service());
    return new DashboardRoutes(controller).getRouter();
  }
}

export default DashboardModule.create();
