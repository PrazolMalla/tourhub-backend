import type { Router } from "express";
import { BannerController } from "./banner.controller";
import { BannerRepository } from "./banner.repository";
import { BannerRoutes } from "./banner.routes";
import { BannerService } from "./banner.service";

export class BannerModule {
  private static _service: BannerService | null = null;

  static service(): BannerService {
    if (!this._service) {
      this._service = new BannerService(new BannerRepository());
    }
    return this._service;
  }

  static create(): Router {
    const controller = new BannerController(this.service());
    return new BannerRoutes(controller).getRouter();
  }
}

export default BannerModule.create();
