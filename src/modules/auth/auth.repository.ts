import { Types, type HydratedDocument } from "mongoose";
import { BaseRepository } from "../../core/base/base.repository";
import { UserModel, type UserDoc } from "../user/user.model";

/**
 * Customer-side auth queries. After the user/admin split, all admin lookups
 * live on AdminRepository — this repository only touches the `users`
 * collection.
 */
export class AuthRepository extends BaseRepository<UserDoc> {
  constructor() {
    super(UserModel);
  }

  /** Returns the customer with sensitive fields included (password, OTP). */
  async findByEmailWithSecrets(email: string): Promise<HydratedDocument<UserDoc> | null> {
    return this.model.findOne({ email }).select("+password +resetOtp +otpExpiry");
  }

  async findByEmail(email: string): Promise<HydratedDocument<UserDoc> | null> {
    return this.model.findOne({ email });
  }

  async findByGoogleId(googleId: string): Promise<HydratedDocument<UserDoc> | null> {
    return this.model.findOne({ googleId });
  }

  async linkGoogleId(userId: string, googleId: string): Promise<void> {
    await this.model.findByIdAndUpdate(userId, { googleId });
  }

  async setOtp(userId: string, otpHash: string | null, expiry: Date | null): Promise<void> {
    await this.model.findByIdAndUpdate(userId, { resetOtp: otpHash, otpExpiry: expiry });
  }

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.model.findByIdAndUpdate(userId, {
      password: passwordHash,
      resetOtp: null,
      otpExpiry: null,
    });
  }

  async updateLastLogin(userId: string, ip?: string): Promise<void> {
    const update: Record<string, unknown> = { lastLoginAt: new Date() };
    if (ip) update.lastLoginIp = ip;
    await this.model.findByIdAndUpdate(userId, update);
  }

  async markBanned(userId: string, reason: string, bannedBy?: string): Promise<void> {
    const update: Record<string, unknown> = {
      isBanned: true,
      bannedReason: reason,
      bannedAt: new Date(),
    };
    if (bannedBy) update.bannedBy = new Types.ObjectId(bannedBy);
    await this.model.findByIdAndUpdate(userId, update);
  }
}
