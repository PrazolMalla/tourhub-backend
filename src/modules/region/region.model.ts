import { Schema, model, type HydratedDocument } from "mongoose";

export type RegionType = "trek-region" | "tour-category";

export interface RegionDoc {
  name: string;
  slug: string;
  /** Short machine key e.g. "everest", "trekking". */
  key: string;
  type: RegionType;
  /** Optional long display label e.g. "Everest Region · Khumbu". */
  longLabel?: string;
  description?: string;
  imageUrl?: string;
  /** Locally uploaded image stored under uploads/regions/. */
  imagePath?: string;
  isActive: boolean;
  sortOrder: number;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const regionSchema = new Schema<RegionDoc>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    key: { type: String, required: true, trim: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ["trek-region", "tour-category"],
      default: "trek-region",
      index: true,
    },
    longLabel: { type: String, trim: true },
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    imagePath: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

export const RegionModel = model<RegionDoc>("Region", regionSchema);
export type RegionDocument = HydratedDocument<RegionDoc>;
