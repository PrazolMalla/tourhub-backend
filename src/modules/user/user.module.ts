import type { Router } from "express";
import { UserController } from "./user.controller";
import { UserRepository } from "./user.repository";
import { UserRoutes } from "./user.routes";
import { UserService } from "./user.service";

export class UserModule {
  static create(): Router {
    const repository = new UserRepository();
    const service = new UserService(repository);
    const controller = new UserController(service);
    return new UserRoutes(controller).getRouter();
  }
}

export default UserModule.create();
