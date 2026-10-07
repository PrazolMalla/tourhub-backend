import { Schema, Types, model, type HydratedDocument } from "mongoose";

export interface TripImage {
  /** Cloudinary public_id (needed to delete/replace this asset). Field name kept as `path` for API back-compat. */
  path: string;
  /** Cloudinary secure delivery URL. */
  url: string;
  alt?: string;
  isPrimary?: boolean;
  sizeBytes?: number;
  mimeType?: string;
}

/** A single altitude waypoint rendered on the trek's altitude profile. */
export interface TripAltitude {
  /** Label for the point, e.g. "Lukla". */
  l: string;
  /** Metres above sea level. */
  m: number;
}

/** A single day in the trek/tour itinerary. */
export interface TripItinDay {
  /** Day label, e.g. "Day 1". */
  d: string;
  /** Title for the day, e.g. "Fly to Lukla, trek to Phakding". */
  t: string;
  /** Optional body / description. */
  b?: string;
  /** Optional meta chips (e.g. ["3,500m", "5h walk"]). */
  meta?: string[];
}

/** A trek OR tour package surfaced on the Nepal trekking website. */
export interface TripDoc {
  title: string;
  slug: string;
  /** "trek" or "tour" — drives filtering and badges on the site. */
  kind: "trek" | "tour";
  /** Country key, e.g. "nepal" or "malaysia". */
  country: string;
  /** Region key, e.g. "everest". */
  region: string;
  /** Long region label, e.g. "Everest Region · Khumbu". */
  regionL?: string;
  /** Category keys, e.g. ["trekking","adventure"]. */
  cats: string[];
  days: number;
  maxAlt?: string;
  diff?: string;
  season?: string;
  group?: string;
  /** Display price string, e.g. "1,390" (kept as a string, not a number). */
  price?: string;
  /** Display strike-through price string, e.g. "1,690". */
  was?: string;
  rating?: string;
  reviews?: string;
  badge?: string;
  /** Short subtitle shown on cards and the detail hero. */
  sub?: string;
  /** External/main image URL fallback (used when no uploaded images). */
  img?: string;
  overview?: string[];
  highlights?: string[];
  /** Video URL (YouTube/Vimeo link or embed URL) shown in the "About This Journey" section. */
  videoUrl?: string;
  inc?: string[];
  exc?: string[];
  /** External gallery URLs (fallback when no uploaded images). */
  gallery?: string[];
  altitude?: TripAltitude[];
  itin?: TripItinDay[];
  /** Uploaded images managed by the admin panel. */
  images: TripImage[];
  isActive: boolean;
  isFeatured: boolean;
  /** Set when an admin archives the trip (hidden from public listings). */
  archivedAt?: Date | null;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const imageSchema = new Schema<TripImage>(
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

const altitudeSchema = new Schema<TripAltitude>(
  {
    l: { type: String, required: true, trim: true },
    m: { type: Number, required: true },
  },
  { _id: false },
);

const itinSchema = new Schema<TripItinDay>(
  {
    d: { type: String, required: true, trim: true },
    t: { type: String, required: true, trim: true },
    b: { type: String, trim: true },
    meta: { type: [String], default: undefined },
  },
  { _id: false },
);

const tripSchema = new Schema<TripDoc>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    kind: { type: String, enum: ["trek", "tour"], required: true, default: "trek", index: true },
    country: {
      type: String,
      required: true,
      default: "nepal",
      trim: true,
      lowercase: true,
      index: true,
    },
    region: { type: String, required: true, trim: true, index: true },
    regionL: { type: String, trim: true },
    cats: { type: [String], default: [], index: true },
    days: { type: Number, required: true, min: 0 },
    maxAlt: { type: String, trim: true },
    diff: { type: String, trim: true },
    season: { type: String, trim: true },
    group: { type: String, trim: true },
    price: { type: String, trim: true },
    was: { type: String, trim: true },
    rating: { type: String, trim: true },
    reviews: { type: String, trim: true },
    badge: { type: String, trim: true },
    sub: { type: String, trim: true },
    img: { type: String, trim: true },
    overview: { type: [String], default: undefined },
    highlights: { type: [String], default: undefined },
    videoUrl: { type: String, trim: true },
    inc: { type: [String], default: undefined },
    exc: { type: [String], default: undefined },
    gallery: { type: [String], default: undefined },
    altitude: { type: [altitudeSchema], default: undefined },
    itin: { type: [itinSchema], default: undefined },
    images: { type: [imageSchema], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true },
);

tripSchema.index({ title: "text", sub: "text", country: "text", region: "text" });

export const TripModel = model<TripDoc>("Trip", tripSchema);
export type TripDocument = HydratedDocument<TripDoc>;
