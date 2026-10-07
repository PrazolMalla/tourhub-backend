import { Schema, Types, model, type HydratedDocument } from "mongoose";

export type SessionUserKind = "user" | "admin";

export interface SessionDoc {
  userId: Types.ObjectId;
  userKind: SessionUserKind;
  sessionId: string;
  deviceId: string;
  refreshTokenHash: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  ip?: string;
  loginAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<SessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    userKind: { type: String, enum: ["user", "admin"], required: true, index: true },
    sessionId: { type: String, required: true, unique: true, index: true },
    deviceId: { type: String, required: true, index: true },
    refreshTokenHash: { type: String, required: true, index: true },
    userAgent: { type: String },
    browser: { type: String },
    os: { type: String },
    ip: { type: String },
    loginAt: { type: Date, default: () => new Date() },
    lastActivityAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date },
    revokedReason: { type: String },
  },
  { timestamps: true },
);

sessionSchema.index({ userId: 1, userKind: 1, revokedAt: 1 });

export const SessionModel = model<SessionDoc>("Session", sessionSchema);
export type SessionDocument = HydratedDocument<SessionDoc>;
