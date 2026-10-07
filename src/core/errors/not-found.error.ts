import { AppError } from "./app.error";

export class NotFoundError extends AppError {
  public readonly statusCode = 404;
  public readonly code = "NOT_FOUND" as const;

  constructor(message = "Resource not found", details?: unknown) {
    super(message, details);
  }
}
