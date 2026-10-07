import type { ZodIssue } from "zod";
import { AppError } from "./app.error";

export class ValidationError extends AppError {
  public readonly statusCode = 422;
  public readonly code = "VALIDATION_ERROR" as const;
  public readonly issues: ZodIssue[];

  constructor(message = "Validation failed", issues: ZodIssue[] = []) {
    super(message, issues);
    this.issues = issues;
  }
}
