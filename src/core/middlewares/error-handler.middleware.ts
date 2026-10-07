import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app.error";
import { ValidationError } from "../errors/validation.error";
import { ResponseBuilder } from "../utils/response.builder";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

export class ErrorHandlerMiddleware {
  public handle: ErrorRequestHandler = (err, req, res, _next) => {
    const reqLogger = req.requestId ? logger.child({ requestId: req.requestId }) : logger;

    if (err instanceof ZodError) {
      const validation = new ValidationError("Request validation failed", err.issues);
      reqLogger.warn(validation.message, { issues: err.issues });
      res
        .status(validation.statusCode)
        .json(ResponseBuilder.error(validation.code, validation.message, validation.issues));
      return;
    }

    if (err instanceof AppError) {
      reqLogger.warn(err.message, { code: err.code, details: err.details });
      res.status(err.statusCode).json(ResponseBuilder.error(err.code, err.message, err.details));
      return;
    }

    // Unique-index violation (e.g. two concurrent creates racing past a
    // service-level existence check) — a client conflict, not a server fault.
    if ((err as { code?: unknown } | null)?.code === 11000) {
      reqLogger.warn("Duplicate key", { keyValue: (err as { keyValue?: unknown }).keyValue });
      res.status(409).json(ResponseBuilder.error("CONFLICT", "Resource already exists"));
      return;
    }

    const error = err instanceof Error ? err : new Error(String(err));
    reqLogger.error(error.message, { name: error.name, stack: error.stack });

    const showStack = env.NODE_ENV === "development";
    res
      .status(500)
      .json(
        ResponseBuilder.error(
          "INTERNAL_ERROR",
          showStack ? error.message : "Internal server error",
          showStack ? { stack: error.stack } : undefined,
        ),
      );
  };
}
