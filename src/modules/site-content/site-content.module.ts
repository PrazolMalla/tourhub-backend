import type { Router } from "express";
import { SiteContentController } from "./site-content.controller";
import { SiteContentRepository } from "./site-content.repository";
import { SiteContentRoutes } from "./site-content.routes";
import { SiteContentService } from "./site-content.service";

export class SiteContentModule {
  private static _service: SiteContentService | null = null;

  static service(): SiteContentService {
    if (!this._service) {
      this._service = new SiteContentService(new SiteContentRepository());
    }
    return this._service;
  }

  static create(): Router {
    const controller = new SiteContentController(this.service());
    return new SiteContentRoutes(controller).getRouter();
  }
}

export default SiteContentModule.create();
