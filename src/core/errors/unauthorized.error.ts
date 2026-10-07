import { AppError } from "./app.error";

export class UnauthorizedError extends AppError {
  public readonly statusCode = 401;
  public readonly code = "UNAUTHORIZED" as const;

  constructor(message = "Unauthorized", details?: unknown) {
    super(message, details);
  }
}
