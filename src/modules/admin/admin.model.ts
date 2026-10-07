import { Schema, Types, model, type HydratedDocument } from "mongoose";

export const ADMIN_ROLES = ["superadmin", "admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export interface AdminDoc {
  email: string;
  name?: string;
  password?: string;
  role: AdminRole;
  resetOtp?: string;
  otpExpiry?: Date;
  /** Google OAuth subject id (`sub`). Sparse-unique — set only on admins linked to Google. */
  googleId?: string;
  isActive: boolean;
  isBanned: boolean;
  bannedReason?: string;
  /** Admin id that performed the block (null for system-initiated like OAuth auto-block). */
  bannedBy?: Types.ObjectId;
  bannedAt?: Date;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<AdminDoc>(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, trim: true },
    password: { type: String, select: false },
    role: {
      type: String,
      enum: ADMIN_ROLES,
      default: "admin",
      index: true,
    },
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
  { timestamps: true, collection: "admins" },
);

export const AdminModel = model<AdminDoc>("Admin", adminSchema);
export type AdminDocument = HydratedDocument<AdminDoc>;
