import { AppError } from "./app.error";

export class ForbiddenError extends AppError {
  public readonly statusCode = 403;
  public readonly code = "FORBIDDEN" as const;

  constructor(message = "Forbidden", details?: unknown) {
    super(message, details);
  }
}
