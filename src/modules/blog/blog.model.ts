import { Schema, Types, model, type HydratedDocument } from "mongoose";

export interface BlogImage {
  /** Cloudinary public_id (needed to delete/replace this asset). Field name kept as `path` for API back-compat. */
  path: string;
  /** Cloudinary secure delivery URL. */
  url: string;
  alt?: string;
  isPrimary?: boolean;
  sizeBytes?: number;
  mimeType?: string;
}

/**
 * A lightweight pointer to another article rendered in the "Related reads"
 * rail on the blog detail page. Stored denormalised so the rail can render
 * without an extra lookup per related post.
 */
export interface BlogRelated {
  slug: string;
  category: string;
  title: string;
}

export interface BlogDoc {
  title: string;
  slug: string;
  /** SEO / meta description. */
  description?: string;
  /** Editorial category, e.g. "Trekking Guide". */
  category?: string;
  /** Human-readable date, e.g. "15 January 2026". */
  dateLabel?: string;
  /** Machine date used for sorting public listings. */
  datePublished?: Date;
  /** Estimated reading time, e.g. "9 min read". */
  readTime?: string;
  /** Alt text for the hero image. */
  heroAlt?: string;
  /** External hero image URL — fallback when no image has been uploaded. */
  heroImage?: string;
  /** Pre-rendered article body (HTML or markdown). */
  body: string;
  /** Short teaser shown on cards and listings. */
  excerpt?: string;
  /** Optional label for the article's related-trek button. */
  exploreText?: string;
  /** Optional destination for the article's related-trek button. */
  exploreHref?: string;
  featured: boolean;
  /** Related-article pointers rendered in the detail-page rail. */
  related: BlogRelated[];
  images: BlogImage[];
  /** Published flag — hidden from the public site when false. */
  isActive: boolean;
  /** Set when an admin archives the post (hidden from public listings). */
  archivedAt?: Date | null;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const imageSchema = new Schema<BlogImage>(
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

const relatedSchema = new Schema<BlogRelated>(
  {
    slug: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const blogSchema = new Schema<BlogDoc>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true, index: true },
    dateLabel: { type: String, trim: true },
    datePublished: { type: Date, index: true },
    readTime: { type: String, trim: true },
    heroAlt: { type: String, trim: true },
    heroImage: { type: String, trim: true },
    body: { type: String, maxlength: 200_000 },
    excerpt: { type: String, trim: true },
    exploreText: { type: String, trim: true },
    exploreHref: { type: String, trim: true },
    featured: { type: Boolean, default: false, index: true },
    related: { type: [relatedSchema], default: [] },
    images: { type: [imageSchema], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    archivedAt: { type: Date, default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true },
);

blogSchema.index({ title: "text", description: "text", excerpt: "text" });

export const BlogModel = model<BlogDoc>("Blog", blogSchema);
export type BlogDocument = HydratedDocument<BlogDoc>;
