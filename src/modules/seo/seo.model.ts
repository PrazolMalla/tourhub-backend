import { Schema, model, type HydratedDocument } from "mongoose";

/**
 * Content types that can carry their own SEO record. `static_page` covers
 * routes with no backing DB document (home, about, listing pages, …) —
 * `entityId` is a fixed page key for those (see `STATIC_PAGE_KEYS`) and the
 * Mongo `_id` string for everything else.
 */
export type SeoEntityType = "static_page" | "trip" | "blog" | "holiday" | "vehicle";

export const SEO_ENTITY_TYPES: SeoEntityType[] = [
  "static_page",
  "trip",
  "blog",
  "holiday",
  "vehicle",
];

/**
 * User-friendly robots controls — never store the raw directive string, it's
 * derived (see `computeRobotsString` in seo.types.ts) so the checkboxes and
 * the generated value can never drift apart.
 */
export interface SeoRobots {
  index: boolean;
  follow: boolean;
  noArchive: boolean;
  noImageIndex: boolean;
  noSnippet: boolean;
}

export interface SeoImage {
  /** Cloudinary secure delivery URL. */
  url: string;
  /** Cloudinary public_id — needed to delete/replace this asset. Absent for legacy/external URLs. */
  path?: string;
  alt?: string;
}

export interface SeoDoc {
  entityType: SeoEntityType;
  /** Mongo ObjectId string for DB-backed entities, or a static-page key. */
  entityId: string;

  metaTitle?: string;
  metaDescription?: string;
  /** Not a ranking factor — kept for completeness / legacy search widgets only. */
  keywords: string[];
  canonicalUrl?: string;
  robots: SeoRobots;

  ogTitle?: string;
  ogDescription?: string;
  ogImage?: SeoImage;

  twitterCard: "summary" | "summary_large_image";
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: SeoImage;

  /** When true (default), the public site emits auto-generated JSON-LD for this record. */
  structuredDataEnabled: boolean;

  /** When true, the public site's navigation link to this page opens in a new tab. Per-page, not site-wide. */
  openInNewTab: boolean;

  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const seoImageSchema = new Schema<SeoImage>(
  {
    url: { type: String, required: true, trim: true },
    path: { type: String, trim: true },
    alt: { type: String, trim: true },
  },
  { _id: false },
);

const robotsSchema = new Schema<SeoRobots>(
  {
    index: { type: Boolean, default: true },
    follow: { type: Boolean, default: true },
    noArchive: { type: Boolean, default: false },
    noImageIndex: { type: Boolean, default: false },
    noSnippet: { type: Boolean, default: false },
  },
  { _id: false },
);

const seoSchema = new Schema<SeoDoc>(
  {
    entityType: { type: String, required: true, enum: SEO_ENTITY_TYPES, index: true },
    entityId: { type: String, required: true, trim: true, index: true },

    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    keywords: { type: [String], default: [] },
    canonicalUrl: { type: String, trim: true },
    robots: { type: robotsSchema, default: () => ({}) },

    ogTitle: { type: String, trim: true },
    ogDescription: { type: String, trim: true },
    ogImage: { type: seoImageSchema },

    twitterCard: {
      type: String,
      enum: ["summary", "summary_large_image"],
      default: "summary_large_image",
    },
    twitterTitle: { type: String, trim: true },
    twitterDescription: { type: String, trim: true },
    twitterImage: { type: seoImageSchema },

    structuredDataEnabled: { type: Boolean, default: true },
    openInNewTab: { type: Boolean, default: false },

    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

// One SEO record per entity — upserts key off this pair everywhere.
seoSchema.index({ entityType: 1, entityId: 1 }, { unique: true });

export const SeoModel = model<SeoDoc>("Seo", seoSchema);
export type SeoDocument = HydratedDocument<SeoDoc>;
