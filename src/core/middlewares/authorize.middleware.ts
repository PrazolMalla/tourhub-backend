import type { RequestHandler } from "express";
import { ForbiddenError, UnauthorizedError } from "../errors";

/**
 * RBAC guard. Mount AFTER `AuthMiddleware` — reads `req.user.role` and
 * forwards only when the role is in the allowed list. Throws
 * `UnauthorizedError` if `req.user` is missing entirely (auth wasn't run)
 * and `ForbiddenError` if the role isn't allowed.
 */
export class AuthorizeMiddleware {
  constructor(private readonly allowedRoles: readonly string[]) {}

  public handle: RequestHandler = (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError("Not authenticated"));
      return;
    }
    const role = req.user.role;
    // Defense-in-depth: this middleware is only ever mounted on admin-only
    // routes, so the token MUST be of kind="admin". A customer JWT that
    // somehow grew a `role` field (forged secret, bug, dev override) is
    // rejected before the role check even runs.
    if (req.user.kind !== "admin") {
      next(new ForbiddenError(`Admin session required (kind='${req.user.kind ?? "(none)"}')`));
      return;
    }
    if (role === undefined || !this.allowedRoles.includes(role)) {
      next(new ForbiddenError(`Role '${role ?? "(none)"}' is not authorized`));
      return;
    }
    next();
  };

  static roles(...allowedRoles: string[]): RequestHandler {
    return new AuthorizeMiddleware(allowedRoles).handle;
  }
}
