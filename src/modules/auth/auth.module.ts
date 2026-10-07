import type { Router } from "express";
import { AdminRepository } from "../admin/admin.repository";
import { AuthController } from "./auth.controller";
import { AuthRepository } from "./auth.repository";
import { AuthRoutes } from "./auth.routes";
import { AuthService } from "./auth.service";
import { RefreshTokenRepository } from "./refresh-token.repository";

export class AuthModule {
  static create(): Router {
    const userRepo = new AuthRepository();
    const adminRepo = new AdminRepository();
    const refreshTokens = new RefreshTokenRepository();
    const service = new AuthService(userRepo, adminRepo, refreshTokens);
    const controller = new AuthController(service);
    return new AuthRoutes(controller).getRouter();
  }
}

export default AuthModule.create();
