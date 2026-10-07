import { AppError } from "./app.error";

export class ConflictError extends AppError {
  public readonly statusCode = 409;
  public readonly code = "CONFLICT" as const;

  constructor(message = "Resource conflict", details?: unknown) {
    super(message, details);
  }
}
