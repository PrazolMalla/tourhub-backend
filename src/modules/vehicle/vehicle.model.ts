import { Schema, model, type HydratedDocument } from "mongoose";

/** A spec/fact icon key — resolved to an icon component on the frontend. */
export type VehicleIcon =
  | "users"
  | "bag"
  | "ac"
  | "trend"
  | "calendar"
  | "clock"
  | "airport"
  | "drivetrain"
  | "mountain"
  | "road";

export interface VehicleSpec {
  icon: string;
  label: string;
}

export interface VehicleFact {
  label: string;
  value: string;
  icon: string;
}

export interface VehicleImage {
  /** Cloudinary public_id (needed to delete/replace this asset). Field name kept as `path` for API back-compat. */
  path: string;
  /** Cloudinary secure delivery URL. */
  url: string;
  alt?: string;
  isPrimary?: boolean;
  sizeBytes?: number;
  mimeType?: string;
}

/** A hire-a-vehicle fleet entry managed by admins. */
export interface VehicleDoc {
  slug: string;
  name: string;
  tag: string;
  desc: string;
  /** External / bundled image URL fallback (used when no uploaded image). */
  img?: string;
  specs: VehicleSpec[];
  overview: string[];
  features: string[];
  facts: VehicleFact[];
  /** External gallery URLs fallback. */
  gallery: string[];
  /** Uploaded images (admin-managed); first/primary wins over `img`. */
  images: VehicleImage[];
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const specSchema = new Schema<VehicleSpec>(
  {
    icon: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const factSchema = new Schema<VehicleFact>(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    icon: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const imageSchema = new Schema<VehicleImage>(
  {
    path: { type: String, required: true },
    url: { type: String, required: true },
    alt: { type: String },
    isPrimary: { type: Boolean, default: false },
    sizeBytes: { type: Number },
    mimeType: { type: String },
  },
  { _id: false },
);

const vehicleSchema = new Schema<VehicleDoc>(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    name: { type: String, required: true, trim: true },
    tag: { type: String, trim: true, default: "" },
    desc: { type: String, trim: true, default: "" },
    img: { type: String, trim: true },
    specs: { type: [specSchema], default: [] },
    overview: { type: [String], default: [] },
    features: { type: [String], default: [] },
    facts: { type: [factSchema], default: [] },
    gallery: { type: [String], default: [] },
    images: { type: [imageSchema], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    sortOrder: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

vehicleSchema.index({ name: "text", tag: "text", desc: "text" });

export const VehicleModel = model<VehicleDoc>("Vehicle", vehicleSchema);
export type VehicleDocument = HydratedDocument<VehicleDoc>;
