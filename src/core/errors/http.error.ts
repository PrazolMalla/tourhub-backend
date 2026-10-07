import { AppError, type ErrorCode } from "./app.error";

export class HttpError extends AppError {
  public readonly statusCode: number;
  public readonly code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message, details);
    this.statusCode = statusCode;
    this.code = code;
  }

  static badRequest(message = "Bad request", details?: unknown): HttpError {
    return new HttpError(400, "BAD_REQUEST", message, details);
  }

  static unauthorized(message = "Unauthorized", details?: unknown): HttpError {
    return new HttpError(401, "UNAUTHORIZED", message, details);
  }

  static forbidden(message = "Forbidden", details?: unknown): HttpError {
    return new HttpError(403, "FORBIDDEN", message, details);
  }

  static notFound(message = "Not found", details?: unknown): HttpError {
    return new HttpError(404, "NOT_FOUND", message, details);
  }

  static conflict(message = "Conflict", details?: unknown): HttpError {
    return new HttpError(409, "CONFLICT", message, details);
  }

  static internal(message = "Internal server error", details?: unknown): HttpError {
    return new HttpError(500, "INTERNAL_ERROR", message, details);
  }
}
