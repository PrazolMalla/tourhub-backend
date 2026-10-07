import { Types, type HydratedDocument } from "mongoose";
import { BaseRepository } from "../../core/base/base.repository";
import { ValidationError } from "../../core/errors";
import { AdminModel, type AdminDoc } from "./admin.model";

export class AdminRepository extends BaseRepository<AdminDoc> {
  constructor() {
    super(AdminModel);
  }

  /** Returns the admin with sensitive fields included (password, OTP). */
  async findByEmailWithSecrets(email: string): Promise<HydratedDocument<AdminDoc> | null> {
    return this.model.findOne({ email }).select("+password +resetOtp +otpExpiry");
  }

  async findByEmail(email: string): Promise<HydratedDocument<AdminDoc> | null> {
    return this.model.findOne({ email });
  }

  async findByGoogleId(googleId: string): Promise<HydratedDocument<AdminDoc> | null> {
    return this.model.findOne({ googleId });
  }

  async linkGoogleId(adminId: string, googleId: string): Promise<void> {
    await this.model.findByIdAndUpdate(adminId, { googleId });
  }

  async setOtp(adminId: string, otpHash: string | null, expiry: Date | null): Promise<void> {
    await this.model.findByIdAndUpdate(adminId, { resetOtp: otpHash, otpExpiry: expiry });
  }

  async setPassword(adminId: string, passwordHash: string): Promise<void> {
    await this.model.findByIdAndUpdate(adminId, {
      password: passwordHash,
      resetOtp: null,
      otpExpiry: null,
    });
  }

  async updateLastLogin(adminId: string, ip?: string): Promise<void> {
    const update: Record<string, unknown> = { lastLoginAt: new Date() };
    if (ip) update.lastLoginIp = ip;
    await this.model.findByIdAndUpdate(adminId, update);
  }

  async setBanned(
    adminId: string,
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
    await this.model.findByIdAndUpdate(adminId, update);
  }
}
