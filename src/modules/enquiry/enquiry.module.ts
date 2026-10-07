import type { Router } from "express";
import { EnquiryController } from "./enquiry.controller";
import { EnquiryRepository } from "./enquiry.repository";
import { EnquiryRoutes } from "./enquiry.routes";
import { EnquiryService } from "./enquiry.service";

export class EnquiryModule {
  private static _service: EnquiryService | null = null;

  static service(): EnquiryService {
    if (!this._service) {
      this._service = new EnquiryService(new EnquiryRepository());
    }
    return this._service;
  }

  static create(): Router {
    const controller = new EnquiryController(this.service());
    return new EnquiryRoutes(controller).getRouter();
  }
}

export default EnquiryModule.create();
