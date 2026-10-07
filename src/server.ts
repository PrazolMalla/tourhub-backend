import { env } from "./config/env";
import { database } from "./config/database";
import { logger } from "./config/logger";
import { App } from "./app";
import apiRoutes from "./routes";
import { Seeder } from "./bootstrap/seed";
import { EmailService } from "./core/email/email.service";

const SHUTDOWN_TIMEOUT_MS = 10_000;

const bootstrap = (): void => {
  // Bind the port first — some hosts (e.g. Hostinger) flag the deployment as
  // unhealthy if listen() isn't called within a few seconds, which a slow
  // Mongo Atlas connection can easily exceed. DB connect + seeding happen
  // after, so routes may briefly 500 on a cold start, but the process comes
  // up and gets marked healthy instead of being killed before it can connect.
  const app = new App(apiRoutes);
  const server = app.listen(env.PORT);

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully`);

    const force = setTimeout(() => {
      logger.error("Forced exit after shutdown timeout");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();

    await new Promise<void>((resolve) => {
      server.close((err) => {
        if (err) logger.error("Error closing HTTP server", { err: String(err) });
        resolve();
      });
    });

    await database.disconnect();
    clearTimeout(force);
    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { reason: String(reason) });
  });
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", { err: String(err), stack: err.stack });
    process.exit(1);
  });

  void (async () => {
    try {
      await database.connect();
      await Seeder.run();
      logger.info("Database connected and seeded");
      // Was previously defined but never called anywhere, so prod deploys
      // had no visibility into which email transport (if any) got picked.
      await EmailService.logTransportStatus();
    } catch (err) {
      logger.error("Failed to connect/seed database — exiting", { err: String(err) });
      process.exit(1);
    }
  })();
};

bootstrap();
