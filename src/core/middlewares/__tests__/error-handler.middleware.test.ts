import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ErrorHandlerMiddleware } from "../error-handler.middleware";
import { ConflictError, HttpError } from "../../errors";

const captureRes = () => {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
  };
  const status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return { json };
  });
  const json = jest.fn().mockImplementation((payload: unknown) => {
    res.body = payload;
  });
  return {
    res: { status } as unknown as Response,
    snapshot: res,
  };
};

const handle = (err: unknown) => {
  const middleware = new ErrorHandlerMiddleware();
  const { res, snapshot } = captureRes();
  const req = { requestId: "test-req" } as unknown as Request;
  const next: NextFunction = jest.fn();
  middleware.handle(err, req, res, next);
  return snapshot;
};

describe("ErrorHandlerMiddleware", () => {
  it("translates ZodError to a 422 ValidationError envelope", () => {
    const schema = z.object({ x: z.string() });
    const result = schema.safeParse({ x: 1 });
    if (result.success) throw new Error("expected zod failure");

    const out = handle(result.error);
    expect(out.statusCode).toBe(422);
    expect(out.body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("emits envelope from AppError subclass", () => {
    const out = handle(new ConflictError("Email exists"));
    expect(out.statusCode).toBe(409);
    expect(out.body).toMatchObject({
      success: false,
      error: { code: "CONFLICT", message: "Email exists" },
    });
  });

  it("uses HttpError statusCode and code", () => {
    const out = handle(new HttpError(418, "BAD_REQUEST", "I'm a teapot"));
    expect(out.statusCode).toBe(418);
    expect(out.body).toMatchObject({
      success: false,
      error: { code: "BAD_REQUEST", message: "I'm a teapot" },
    });
  });

  it("falls back to 500 INTERNAL_ERROR for unknown errors", () => {
    const out = handle(new Error("kaboom"));
    expect(out.statusCode).toBe(500);
    expect(out.body).toMatchObject({
      success: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("wraps non-Error throwables into Error", () => {
    const out = handle("string thrown");
    expect(out.statusCode).toBe(500);
    expect(out.body).toMatchObject({ success: false });
  });

  it("works without req.requestId", () => {
    const middleware = new ErrorHandlerMiddleware();
    const { res, snapshot } = captureRes();
    const req = {} as Request;
    middleware.handle(new ConflictError("c"), req, res, jest.fn());
    expect(snapshot.statusCode).toBe(409);
  });

  it("maps a Mongo duplicate-key error (11000) to 409 CONFLICT", () => {
    const err = Object.assign(new Error("E11000 duplicate key"), {
      code: 11000,
      keyValue: { slug: "x" },
    });
    const out = handle(err);
    expect(out.statusCode).toBe(409);
    expect(out.body).toMatchObject({ success: false, error: { code: "CONFLICT" } });
  });
});
