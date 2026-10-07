import { Router } from "express";
import type { GoogleOAuthController } from "./google.controller";

export class GoogleOAuthRoutes {
  constructor(private readonly controller: GoogleOAuthController) {}

  getRouter(): Router {
    const router = Router();
    router.get("/", this.controller.start);
    router.get("/callback", this.controller.callback);
    return router;
  }
}
