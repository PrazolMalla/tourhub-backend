import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

export class Database {
  private connected = false;

  async connect(): Promise<void> {
    if (this.connected) return;

    mongoose.connection.on("error", (err) => {
      logger.error("Mongoose connection error", { err: String(err) });
    });
    mongoose.connection.on("disconnected", () => {
      logger.warn("Mongoose connection lost");
    });

    await mongoose.connect(env.DB_URL);
    this.connected = true;

    const host = env.DB_URL.split("@").pop() ?? "unknown";
    logger.info("Mongoose connected", { host });
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await mongoose.disconnect();
    this.connected = false;
    logger.info("Mongoose disconnected");
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const database = new Database();
