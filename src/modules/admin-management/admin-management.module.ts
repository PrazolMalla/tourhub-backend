import type { Router } from "express";
import { AdminRepository } from "../admin/admin.repository";
import { AdminManagementController } from "./admin-management.controller";
import { AdminManagementRoutes } from "./admin-management.routes";
import { AdminManagementService } from "./admin-management.service";

export class AdminManagementModule {
  private static _service: AdminManagementService | null = null;

  static service(): AdminManagementService {
    if (!this._service) {
      this._service = new AdminManagementService(new AdminRepository());
    }
    return this._service;
  }

  static create(): Router {
    const controller = new AdminManagementController(this.service());
    return new AdminManagementRoutes(controller).getRouter();
  }
}

export default AdminManagementModule.create();
