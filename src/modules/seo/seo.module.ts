import type { Router } from "express";
import { SeoController } from "./seo.controller";
import { SeoRepository } from "./seo.repository";
import { SeoRoutes } from "./seo.routes";
import { SeoService } from "./seo.service";

export class SeoModule {
  private static _service: SeoService | null = null;

  static service(): SeoService {
    if (!this._service) {
      this._service = new SeoService(new SeoRepository());
    }
    return this._service;
  }

  static create(): Router {
    const controller = new SeoController(this.service());
    return new SeoRoutes(controller).getRouter();
  }
}

export default SeoModule.create();
