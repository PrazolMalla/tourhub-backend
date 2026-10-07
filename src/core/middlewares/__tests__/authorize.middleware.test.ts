import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AuthorizeMiddleware } from "../authorize.middleware";
import { ForbiddenError, UnauthorizedError } from "../../errors";

const run = (handler: RequestHandler, user?: Request["user"]) => {
  const req = { user } as unknown as Request;
  const res = {} as Response;
  let err: unknown;
  const next: NextFunction = (e?: unknown) => {
    if (e !== undefined) err = e;
  };
  handler(req, res, next);
  return err;
};

describe("AuthorizeMiddleware", () => {
  it("UnauthorizedError when req.user is missing entirely", () => {
    const err = run(AuthorizeMiddleware.roles("admin"));
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it("ForbiddenError when kind is not 'admin' (customer JWT can't access admin routes)", () => {
    // Defense-in-depth introduced by qa-test.md#H-5: even a customer JWT that
    // somehow carried a role field would be rejected because kind != "admin".
    const err = run(AuthorizeMiddleware.roles("admin"), { id: "u1", kind: "user", role: "admin" });
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  it("ForbiddenError when role is missing", () => {
    const err = run(AuthorizeMiddleware.roles("admin"), { id: "u1", kind: "admin" });
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  it("ForbiddenError when role is not in the allow list", () => {
    const err = run(AuthorizeMiddleware.roles("admin"), {
      id: "u1",
      kind: "admin",
      role: "viewer",
    });
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  it("forwards when kind=admin AND role is allowed", () => {
    const err = run(AuthorizeMiddleware.roles("admin"), {
      id: "u1",
      kind: "admin",
      role: "admin",
    });
    expect(err).toBeUndefined();
  });

  it("supports multiple allowed roles", () => {
    const handler = AuthorizeMiddleware.roles("admin", "moderator");
    expect(run(handler, { id: "u1", kind: "admin", role: "moderator" })).toBeUndefined();
    expect(run(handler, { id: "u1", kind: "admin", role: "viewer" })).toBeInstanceOf(
      ForbiddenError,
    );
  });
});
