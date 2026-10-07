import type { Router } from "express";
import { HolidayController } from "./holiday.controller";
import { HolidayRepository } from "./holiday.repository";
import { HolidayRoutes } from "./holiday.routes";
import { HolidayService } from "./holiday.service";

export class HolidayModule {
  private static _service: HolidayService | null = null;

  static service(): HolidayService {
    if (!this._service) {
      this._service = new HolidayService(new HolidayRepository());
    }
    return this._service;
  }

  static create(): Router {
    const controller = new HolidayController(this.service());
    return new HolidayRoutes(controller).getRouter();
  }
}

export default HolidayModule.create();
