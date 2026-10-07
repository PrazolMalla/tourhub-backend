import { Schema, Types, model, type HydratedDocument } from "mongoose";

export interface UserDoc {
  email: string;
  name?: string;
  password?: string;
  resetOtp?: string;
  otpExpiry?: Date;
  /** Google OAuth subject id (`sub`). Sparse-unique — set only on users linked to Google. */
  googleId?: string;
  isActive: boolean;
  isBanned: boolean;
  bannedReason?: string;
  /** Admin id that performed the block. */
  bannedBy?: Types.ObjectId;
  bannedAt?: Date;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, trim: true },
    password: { type: String, select: false },
    resetOtp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    googleId: { type: String, index: { unique: true, sparse: true } },
    isActive: { type: Boolean, default: true, index: true },
    isBanned: { type: Boolean, default: false, index: true },
    bannedReason: { type: String },
    bannedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    bannedAt: { type: Date },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    phone: { type: String, trim: true },
  },
  { timestamps: true, collection: "users" },
);

export const UserModel = model<UserDoc>("User", userSchema);
export type UserDocument = HydratedDocument<UserDoc>;
