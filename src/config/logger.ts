import pino, { type Logger as PinoLogger, type LoggerOptions } from "pino";
import { env } from "./env";

export class Logger {
  private readonly pino: PinoLogger;

  constructor(instance?: PinoLogger) {
    this.pino = instance ?? Logger.createDefault();
  }

  private static createDefault(): PinoLogger {
    const options: LoggerOptions = {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === "development"
        ? {
            transport: {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "SYS:HH:MM:ss",
                // Keep request logs to a single clean line — the method/url/status
                // is carried by pino-http's customSuccessMessage (see app.ts).
                ignore: "pid,hostname,req,res,responseTime,reqId,responseTimeMs",
              },
            },
          }
        : {}),
      ...(env.NODE_ENV === "test" ? { enabled: false } : {}),
    };
    return pino(options);
  }

  child(bindings: Record<string, unknown>): Logger {
    return new Logger(this.pino.child(bindings));
  }

  info(message: string, ctx?: Record<string, unknown>): void {
    this.pino.info(ctx ?? {}, message);
  }

  warn(message: string, ctx?: Record<string, unknown>): void {
    this.pino.warn(ctx ?? {}, message);
  }

  error(message: string, ctx?: Record<string, unknown>): void {
    this.pino.error(ctx ?? {}, message);
  }

  debug(message: string, ctx?: Record<string, unknown>): void {
    this.pino.debug(ctx ?? {}, message);
  }

  /** Request-line level. Maps to `info` so structured downstreams can filter on bindings. */
  http(message: string, ctx?: Record<string, unknown>): void {
    this.pino.info(ctx ?? {}, message);
  }

  /** Underlying pino instance — for `pino-http` integration. */
  raw(): PinoLogger {
    return this.pino;
  }
}

export const logger = new Logger();
