import { Schema, Types, model, type HydratedDocument } from "mongoose";

export type RefreshTokenUserKind = "user" | "admin";

export interface RefreshTokenDoc {
  tokenHash: string;
  userId: Types.ObjectId;
  userKind: RefreshTokenUserKind;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    userKind: { type: String, enum: ["user", "admin"], required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date },
    replacedByHash: { type: String },
  },
  { timestamps: true },
);

export const RefreshTokenModel = model<RefreshTokenDoc>("RefreshToken", refreshTokenSchema);
export type RefreshTokenDocument = HydratedDocument<RefreshTokenDoc>;
