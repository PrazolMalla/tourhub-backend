import type { Router } from "express";
import { TestimonialController } from "./testimonial.controller";
import { TestimonialRepository } from "./testimonial.repository";
import { TestimonialRoutes } from "./testimonial.routes";
import { TestimonialService } from "./testimonial.service";

export class TestimonialModule {
  private static _service: TestimonialService | null = null;

  static service(): TestimonialService {
    if (!this._service) {
      this._service = new TestimonialService(new TestimonialRepository());
    }
    return this._service;
  }

  static create(): Router {
    const controller = new TestimonialController(this.service());
    return new TestimonialRoutes(controller).getRouter();
  }
}

export default TestimonialModule.create();
