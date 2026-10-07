import { Types, type HydratedDocument } from "mongoose";
import { BaseRepository } from "../../core/base/base.repository";
import { ValidationError } from "../../core/errors";
import { UserModel, type UserDoc } from "./user.model";

export class UserRepository extends BaseRepository<UserDoc> {
  constructor() {
    super(UserModel);
  }

  async findByEmail(email: string): Promise<HydratedDocument<UserDoc> | null> {
    return this.model.findOne({ email });
  }

  async setBanned(
    userId: string,
    isBanned: boolean,
    reason: string | undefined,
    bannedBy: string | undefined,
  ): Promise<void> {
    const update: Record<string, unknown> = { isBanned };
    if (isBanned && bannedBy && !Types.ObjectId.isValid(bannedBy)) {
      throw new ValidationError(`Invalid bannedBy id: ${bannedBy}`);
    }
    if (isBanned) {
      update.bannedReason = reason ?? null;
      update.bannedBy = bannedBy ? new Types.ObjectId(bannedBy) : null;
      update.bannedAt = new Date();
    } else {
      update.bannedReason = null;
      update.bannedBy = null;
      update.bannedAt = null;
    }
    await this.model.findByIdAndUpdate(userId, update);
  }
}
