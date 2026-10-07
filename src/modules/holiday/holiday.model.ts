import { Schema, model, type HydratedDocument } from "mongoose";

/** A festival/holiday landing page managed by admins (Dashain, Tihar, …). */
export interface HolidayFaq {
  q: string;
  a: string;
}

export interface HolidayImage {
  /** Cloudinary public_id (needed to delete/replace this asset). Field name kept as `path` for API back-compat. */
  path: string;
  /** Cloudinary secure delivery URL. */
  url: string;
  alt?: string;
  isPrimary?: boolean;
  sizeBytes?: number;
  mimeType?: string;
}

export interface HolidayDoc {
  name: string;
  slug: string;
  description?: string;
  /** Festival start/end — drive the countdown + listings sort. */
  startDate: Date;
  endDate: Date;
  /** External banner URL fallback (used when no uploaded image). */
  bannerImage?: string;
  /** Uploaded banner images (admin-managed); first/primary wins. */
  images: HolidayImage[];
  discountPercentage: number;
  isFeatured: boolean;
  isActive: boolean;

  // SEO / AEO / GEO
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords: string[];

  // Trekking associations & landing-page content
  recommendedTreks: string[];
  regions: string[];
  body: string[];
  faqs: HolidayFaq[];

  sortOrder: number;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const faqSchema = new Schema<HolidayFaq>(
  {
    q: { type: String, required: true, trim: true },
    a: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const imageSchema = new Schema<HolidayImage>(
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

const holidaySchema = new Schema<HolidayDoc>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    description: { type: String, trim: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    bannerImage: { type: String, trim: true },
    images: { type: [imageSchema], default: [] },
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },
    isFeatured: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    seoTitle: { type: String, trim: true },
    seoDescription: { type: String, trim: true },
    seoKeywords: { type: [String], default: [] },
    recommendedTreks: { type: [String], default: [] },
    regions: { type: [String], default: [] },
    body: { type: [String], default: [] },
    faqs: { type: [faqSchema], default: [] },
    sortOrder: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

holidaySchema.index({ name: "text", description: "text" });

export const HolidayModel = model<HolidayDoc>("Holiday", holidaySchema);
export type HolidayDocument = HydratedDocument<HolidayDoc>;
