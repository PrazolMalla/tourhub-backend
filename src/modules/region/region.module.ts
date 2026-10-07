import type { Router } from "express";
import { RegionController } from "./region.controller";
import { RegionRepository } from "./region.repository";
import { RegionRoutes } from "./region.routes";
import { RegionService } from "./region.service";

export class RegionModule {
  private static _service: RegionService | null = null;

  static service(): RegionService {
    if (!this._service) {
      this._service = new RegionService(new RegionRepository());
    }
    return this._service;
  }

  static create(): Router {
    const controller = new RegionController(this.service());
    return new RegionRoutes(controller).getRouter();
  }
}

export default RegionModule.create();
