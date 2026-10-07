import type { Response } from "express";
import { ResponseBuilder } from "../utils/response.builder";

export abstract class BaseController {
  protected ok<T, M = Record<string, unknown>>(res: Response, data: T, meta?: M): Response {
    return res.status(200).json(ResponseBuilder.success(data, meta));
  }

  protected created<T>(res: Response, data: T): Response {
    return res.status(201).json(ResponseBuilder.created(data));
  }

  protected noContent(res: Response): Response {
    return res.status(204).send();
  }
}
