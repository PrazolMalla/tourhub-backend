export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export abstract class AppError extends Error {
  public readonly isOperational = true;
  public abstract readonly statusCode: number;
  public abstract readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    if (details !== undefined) this.details = details;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
