import { Schema, model, type HydratedDocument } from "mongoose";

export interface PartnerDoc {
  name: string;
  /** Partner website link. */
  url?: string;
  logoUrl?: string;
  /** Locally uploaded logo stored under uploads/partners/. */
  logoPath?: string;
  isActive: boolean;
  sortOrder: number;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const partnerSchema = new Schema<PartnerDoc>(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, trim: true },
    logoUrl: { type: String, trim: true },
    logoPath: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

export const PartnerModel = model<PartnerDoc>("Partner", partnerSchema);
export type PartnerDocument = HydratedDocument<PartnerDoc>;
