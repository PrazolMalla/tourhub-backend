import type { Router } from "express";
import { VehicleController } from "./vehicle.controller";
import { VehicleRepository } from "./vehicle.repository";
import { VehicleRoutes } from "./vehicle.routes";
import { VehicleService } from "./vehicle.service";

export class VehicleModule {
  private static _service: VehicleService | null = null;

  static service(): VehicleService {
    if (!this._service) {
      this._service = new VehicleService(new VehicleRepository());
    }
    return this._service;
  }

  static create(): Router {
    const controller = new VehicleController(this.service());
    return new VehicleRoutes(controller).getRouter();
  }
}

export default VehicleModule.create();
