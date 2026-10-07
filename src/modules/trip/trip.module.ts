import type { Router } from "express";
import { TripController } from "./trip.controller";
import { TripRepository } from "./trip.repository";
import { TripRoutes } from "./trip.routes";
import { TripService } from "./trip.service";

export class TripModule {
  private static _service: TripService | null = null;

  static service(): TripService {
    if (!this._service) {
      this._service = new TripService(new TripRepository());
    }
    return this._service;
  }

  static create(): Router {
    const controller = new TripController(this.service());
    return new TripRoutes(controller).getRouter();
  }
}

export default TripModule.create();
