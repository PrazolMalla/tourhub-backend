import type { Router } from "express";
import { SchoolTripChecklistController } from "./school-trip-checklist.controller";
import { SchoolTripChecklistRepository } from "./school-trip-checklist.repository";
import { ChecklistDownloadLogRepository } from "./checklist-download-log.repository";
import { SchoolTripChecklistRoutes } from "./school-trip-checklist.routes";
import { SchoolTripChecklistService } from "./school-trip-checklist.service";

export class SchoolTripChecklistModule {
  private static _service: SchoolTripChecklistService | null = null;

  static service(): SchoolTripChecklistService {
    if (!this._service) {
      this._service = new SchoolTripChecklistService(
        new SchoolTripChecklistRepository(),
        new ChecklistDownloadLogRepository(),
      );
    }
    return this._service;
  }

  static create(): Router {
    const controller = new SchoolTripChecklistController(this.service());
    return new SchoolTripChecklistRoutes(controller).getRouter();
  }
}

export default SchoolTripChecklistModule.create();
