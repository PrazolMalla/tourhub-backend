import type { RequestHandler } from "express";
import { v4 as uuidv4 } from "uuid";

export class RequestIdMiddleware {
  static readonly HEADER = "x-request-id";

  public handle: RequestHandler = (req, res, next) => {
    const incoming = req.headers[RequestIdMiddleware.HEADER];
    const requestId = typeof incoming === "string" && incoming.length > 0 ? incoming : uuidv4();
    req.requestId = requestId;
    res.setHeader(RequestIdMiddleware.HEADER, requestId);
    next();
  };
}
