import express, { type Express, type Router } from "express";
import helmet from "helmet";
import cors from "cors";
import hpp from "hpp";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import "./core/types/request.types";
import { RequestIdMiddleware } from "./core/middlewares/request-id.middleware";
import { ErrorHandlerMiddleware } from "./core/middlewares/error-handler.middleware";
import { ResponseBuilder } from "./core/utils/response.builder";
import { DynamicRateLimitMiddleware } from "./modules/rate-limit-config/dynamic-rate-limit.middleware";
import { AttachDeviceMiddleware } from "./modules/security/device.middleware";

export class App {
  public readonly express: Express;

  constructor(private readonly router: Router) {
    this.express = express();
    this.setupBaseConfig();
    this.setupSecurity();
    this.setupRequestPipeline();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupBaseConfig(): void {
    this.express.disable("x-powered-by");
    this.express.set("trust proxy", 1);
  }

  private setupSecurity(): void {
    this.express.use(
      helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
      }),
    );
    const allowedOrigins = Array.from(
      new Set(
        [env.CLIENT_URL, env.ADMIN_PANEL_URL, ...env.ALLOWED_ORIGINS].filter((o): o is string =>
          Boolean(o),
        ),
      ),
    );
    // Dev: allow any localhost/127.0.0.1 port (landing may run on 3001, 8000, …).
    const devLocalhostRange = /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/;
    const isDev = env.NODE_ENV !== "production";
    this.express.use(
      cors({
        origin: (origin, cb) => {
          if (!origin) return cb(null, true);
          if (allowedOrigins.includes(origin)) return cb(null, true);
          if (isDev && devLocalhostRange.test(origin)) return cb(null, true);
          return cb(new Error(`CORS: origin ${origin} not allowed`));
        },
        credentials: true,
      }),
    );
    this.express.use(hpp());
    this.express.use(DynamicRateLimitMiddleware.for("global"));
  }

  private setupRequestPipeline(): void {
    const requestId = new RequestIdMiddleware();
    this.express.use(requestId.handle);

    const attachDevice = new AttachDeviceMiddleware();
    this.express.use(attachDevice.handle);

    this.express.use(
      pinoHttp({
        logger: logger.raw(),
        genReqId: (req) => {
          const id = (req as unknown as { requestId?: string }).requestId;
          return id ?? "unknown";
        },
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return "error";
          if (res.statusCode >= 400) return "warn";
          return "info";
        },
        // One clean line per request, e.g. "GET /api/v1/trips/public → 200 (4ms)".
        // Use originalUrl — Express rewrites req.url to the sub-path inside
        // mounted routers by the time the response finishes.
        customSuccessMessage: (req, res, responseTime) =>
          `${req.method} ${(req as { originalUrl?: string }).originalUrl ?? req.url} → ${res.statusCode} (${responseTime}ms)`,
        customErrorMessage: (req, res, err) =>
          `${req.method} ${(req as { originalUrl?: string }).originalUrl ?? req.url} → ${res.statusCode} — ${err.message}`,
      }),
    );

    this.express.use(express.json({ limit: "2mb" }));
    this.express.use(express.urlencoded({ extended: true, limit: "2mb" }));
    this.express.use(cookieParser());
  }

  private setupRoutes(): void {
    this.express.get("/health", (_req, res) => {
      res.status(200).json(ResponseBuilder.success({ status: "ok", uptime: process.uptime() }));
    });
    this.express.use("/api/v1", this.router);
  }

  private setupErrorHandling(): void {
    this.express.use((req, res) => {
      res
        .status(404)
        .json(
          ResponseBuilder.error("NOT_FOUND", `Route not found: ${req.method} ${req.originalUrl}`),
        );
    });

    const errorHandler = new ErrorHandlerMiddleware();
    this.express.use(errorHandler.handle);
  }

  listen(port: number): import("http").Server {
    return this.express.listen(port, () => {
      logger.info(`Server listening on port ${port}`, { env: env.NODE_ENV });
    });
  }
}
