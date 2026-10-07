import type { RequestHandler } from "express";
import { ZodError, type ZodType } from "zod";
import { ValidationError } from "../errors/validation.error";

const wrap = (
  source: "body" | "params" | "query",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodType<any>,
  /** When true, replaces `req.body` with the parsed value. Off for params/query (Express 5 query is read-only). */
  mutate: boolean,
): RequestHandler => {
  const label =
    source === "body"
      ? "Request body validation failed"
      : source === "params"
        ? "Path parameters validation failed"
        : "Query string validation failed";

  return async (req, _res, next) => {
    try {
      const value = await schema.parseAsync(req[source]);
      if (mutate && source === "body") {
        req.body = value;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new ValidationError(label, err.issues));
        return;
      }
      next(err);
    }
  };
};

export class ValidateMiddleware {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static body<T extends ZodType<any>>(schema: T): RequestHandler {
    return wrap("body", schema, true);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static params<T extends ZodType<any>>(schema: T): RequestHandler {
    return wrap("params", schema, false);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static query<T extends ZodType<any>>(schema: T): RequestHandler {
    return wrap("query", schema, false);
  }
}
