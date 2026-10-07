import { Schema, model, type HydratedDocument } from "mongoose";

/**
 * Section keys are open-ended (super-admin can introduce new sections without a
 * code change). Conventional keys used by the frontend:
 *
 *   - hero      → hero slider with rotation interval
 *   - about     → About-Us page
 *   - gallery   → Gallery page
 *   - contact   → Contact page details (phone/email/address/socials/map)
 *   - faq       → FAQ entries
 *   - testimonials, features, principles, footer, ...
 *
 * `data` is a free-form JSON blob — the frontend renders it section-by-section
 * and the admin panel edits it through purpose-built forms. We trust admins
 * but cap byte size and validate at the validator layer.
 */
export interface SiteImage {
  /** Cloudinary public_id (needed to delete/replace this asset). Field name kept as `path` for API back-compat. */
  path: string;
  /** Cloudinary secure delivery URL. */
  url: string;
  alt?: string;
  caption?: string;
  sortOrder?: number;
  mimeType?: string;
  sizeBytes?: number;
}

export interface SiteContentDoc {
  /** Section key, lower-snake-case, e.g. "hero", "about", "gallery". */
  section: string;
  /** Free-form JSON for headline copy, layout flags, slider interval, etc. */
  data: Record<string, unknown>;
  /** Ordered images attached to this section (slides for hero, gallery items, etc.). */
  images: SiteImage[];
  /** Whether the section is published. Unpublished sections fall back to defaults. */
  isPublished: boolean;
  /** Free-form notes (admin only). */
  notes?: string;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const siteImageSchema = new Schema<SiteImage>(
  {
    path: { type: String, required: true },
    url: { type: String, required: true },
    alt: { type: String, trim: true },
    caption: { type: String, trim: true },
    sortOrder: { type: Number, default: 0 },
    mimeType: { type: String },
    sizeBytes: { type: Number },
  },
  { _id: false },
);

const siteContentSchema = new Schema<SiteContentDoc>(
  {
    section: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    data: { type: Schema.Types.Mixed, default: {} },
    images: { type: [siteImageSchema], default: [] },
    isPublished: { type: Boolean, default: true, index: true },
    notes: { type: String },
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

export const SiteContentModel = model<SiteContentDoc>("SiteContent", siteContentSchema);
export type SiteContentDocument = HydratedDocument<SiteContentDoc>;
