import type { Router } from "express";
import { BlogController } from "./blog.controller";
import { BlogRepository } from "./blog.repository";
import { BlogRoutes } from "./blog.routes";
import { BlogService } from "./blog.service";

export class BlogModule {
  private static _service: BlogService | null = null;

  static service(): BlogService {
    if (!this._service) {
      this._service = new BlogService(new BlogRepository());
    }
    return this._service;
  }

  static create(): Router {
    const controller = new BlogController(this.service());
    return new BlogRoutes(controller).getRouter();
  }
}

export default BlogModule.create();
