import type { Router } from "express";
import { PartnerController } from "./partner.controller";
import { PartnerRepository } from "./partner.repository";
import { PartnerRoutes } from "./partner.routes";
import { PartnerService } from "./partner.service";

export class PartnerModule {
  private static _service: PartnerService | null = null;

  static service(): PartnerService {
    if (!this._service) {
      this._service = new PartnerService(new PartnerRepository());
    }
    return this._service;
  }

  static create(): Router {
    const controller = new PartnerController(this.service());
    return new PartnerRoutes(controller).getRouter();
  }
}

export default PartnerModule.create();
