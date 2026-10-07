jest.mock("../../../utils/auth/jwt.util", () => ({
  __esModule: true,
  default: {
    verifyAccessToken: jest.fn(),
  },
}));

import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwtService from "../../../utils/auth/jwt.util";
import { AuthMiddleware } from "../auth.middleware";
import { UnauthorizedError } from "../../errors";

interface RunResult {
  user: Request["user"];
  err: unknown;
}

const run = (
  handler: RequestHandler,
  init: { headers?: Record<string, string>; cookies?: Record<string, string> } = {},
): RunResult => {
  const req = {
    headers: init.headers ?? {},
    cookies: init.cookies ?? {},
  } as unknown as Request;
  const res = {} as Response;
  let err: unknown;
  const next: NextFunction = (e?: unknown) => {
    if (e !== undefined) err = e;
  };
  handler(req, res, next);
  return { user: req.user, err };
};

describe("AuthMiddleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("401 when no token is present", () => {
    const result = run(new AuthMiddleware().handle);
    expect(result.err).toBeInstanceOf(UnauthorizedError);
    expect(result.user).toBeUndefined();
  });

  it("401 when token verification throws", () => {
    jest.mocked(jwtService.verifyAccessToken).mockImplementation(() => {
      throw new Error("expired");
    });
    const result = run(new AuthMiddleware().handle, {
      headers: { authorization: "Bearer bogus.token.here" },
    });
    expect(result.err).toBeInstanceOf(UnauthorizedError);
  });

  it("sets req.user from a valid Bearer token", () => {
    jest.mocked(jwtService.verifyAccessToken).mockReturnValue({
      id: "u1",
      kind: "admin",
      role: "admin",
    });
    const result = run(new AuthMiddleware().handle, {
      headers: { authorization: "Bearer good.token.here" },
    });
    expect(result.err).toBeUndefined();
    expect(result.user).toEqual({ id: "u1", kind: "admin", role: "admin" });
  });

  it("falls back to the access cookie when no header is set", () => {
    jest.mocked(jwtService.verifyAccessToken).mockReturnValue({ id: "u2", kind: "user" });
    const result = run(new AuthMiddleware().handle, {
      cookies: { access_token: "cookie.token" },
    });
    expect(result.err).toBeUndefined();
    expect(result.user).toEqual({ id: "u2", kind: "user" });
  });

  it("ignores empty Bearer prefix", () => {
    const result = run(new AuthMiddleware().handle, {
      headers: { authorization: "Bearer " },
    });
    expect(result.err).toBeInstanceOf(UnauthorizedError);
  });

  it("static create() returns a working RequestHandler", () => {
    jest.mocked(jwtService.verifyAccessToken).mockReturnValue({ id: "u3", kind: "user" });
    const handler = AuthMiddleware.create();
    const result = run(handler, { headers: { authorization: "Bearer t" } });
    expect(result.user?.id).toBe("u3");
  });
});
