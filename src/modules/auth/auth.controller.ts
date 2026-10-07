import type { Request, Response } from "express";
import { BaseController } from "../../core/base/base.controller";
import { asyncHandler } from "../../core/middlewares/async-handler";
import { UnauthorizedError } from "../../core/errors";
import { AppConstants } from "../../constants";
import cookieService from "../../utils/auth/cookie.util";
import { getClientIp } from "../security/client-ip.util";
import type { AuthService } from "./auth.service";
import type { AuthTokens, LoginContext } from "./auth.types";

export class AuthController extends BaseController {
  constructor(private readonly authService: AuthService) {
    super();
  }

  register = asyncHandler(async (req: Request, res: Response) => {
    const tokens = await this.authService.register(req.body, this.ctx(req));
    this.setAuthCookies(res, tokens);
    return this.created(res, { message: "Registration successful", tokens });
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const tokens = await this.authService.login(req.body, this.ctx(req));
    this.setAuthCookies(res, tokens);
    return this.ok(res, { message: "Login successful", tokens });
  });

  /** Queries the admins collection — customer accounts cannot log in here. */
  adminLogin = asyncHandler(async (req: Request, res: Response) => {
    const tokens = await this.authService.adminLogin(req.body, this.ctx(req));
    this.setAuthCookies(res, tokens);
    return this.ok(res, { message: "Admin login successful", tokens });
  });

  /**
   * Kind-aware "who am I". Returns the admin doc when the access token has
   * `kind=admin`, the customer doc when `kind=user`. The admin panel hits
   * this on hydrate; the user frontend can use either this or `/users/me`.
   */
  me = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new UnauthorizedError("Not authenticated");
    const kind = req.user.kind ?? "user";
    const account = await this.authService.getCurrentAccount(req.user.id, kind);
    return this.ok(res, account);
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = this.readRefreshCookie(req) ?? this.readRefreshFromBody(req);
    if (!refreshToken) throw new UnauthorizedError("Missing refresh token");
    const tokens = await this.authService.refresh(refreshToken, this.ctx(req));
    this.setAuthCookies(res, tokens);
    return this.ok(res, { message: "Token refreshed", tokens });
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const rt = this.readRefreshCookie(req) ?? this.readRefreshFromBody(req);
    await this.authService.logout(rt, this.ctx(req));
    cookieService.clearAuthCookie(res);
    cookieService.clearRefreshCookie(res);
    return this.ok(res, { message: "Logout successful" });
  });

  forgetPassword = asyncHandler(async (req: Request, res: Response) => {
    await this.authService.forgetPassword(req.body);
    return this.ok(res, {
      message: "If the email is registered, an OTP has been sent.",
    });
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    await this.authService.resetPassword(req.body);
    return this.ok(res, { message: "Password has been reset." });
  });

  resendOtp = asyncHandler(async (req: Request, res: Response) => {
    await this.authService.resendOtp(req.body);
    return this.ok(res, {
      message: "If the email is registered, a new OTP has been sent.",
    });
  });

  private ctx(req: Request): LoginContext {
    const ip = getClientIp(req);
    const ua =
      typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;
    const deviceId =
      typeof req.headers["x-device-id"] === "string" && req.headers["x-device-id"].length > 0
        ? req.headers["x-device-id"]
        : undefined;
    const ctx: LoginContext = { ip };
    if (ua !== undefined) ctx.userAgent = ua;
    if (deviceId !== undefined) ctx.deviceId = deviceId;
    return ctx;
  }

  private setAuthCookies(res: Response, tokens: AuthTokens): void {
    cookieService.setAuthCookie(res, tokens.accessToken);
    cookieService.setRefreshCookie(res, tokens.refreshToken);
  }

  private readRefreshCookie(req: Request): string | undefined {
    const value = (req.cookies as Record<string, unknown> | undefined)?.[
      AppConstants.REFRESH_COOKIE_NAME
    ];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private readRefreshFromBody(req: Request): string | undefined {
    const value = (req.body as Record<string, unknown> | undefined)?.refreshToken;
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }
}
