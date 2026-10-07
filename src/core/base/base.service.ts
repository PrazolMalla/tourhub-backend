import type { ClientSession } from "mongoose";
import mongoose from "mongoose";
import { Logger, logger } from "../../config/logger";

export abstract class BaseService<TRepo> {
  protected readonly logger: Logger;

  constructor(protected readonly repository: TRepo) {
    this.logger = logger.child({ service: this.constructor.name });
  }

  /**
   * Run `fn` inside a Mongoose session-backed transaction. Requires a replica set
   * (or `transactionOptions: { readPreference: "primary" }` plus single-node replica setup).
   */
  protected async withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    try {
      let result: T;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result!;
    } finally {
      await session.endSession();
    }
  }
}
