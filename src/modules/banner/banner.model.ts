import { Schema, model, type HydratedDocument } from "mongoose";

/**
 * Banners are CMS-managed promotional / hero images that can be attached to
 * specific sections of the public site:
 *
 *   - "landing"  → Hero slider on the home page
 *   - "about"    → About page hero
 *   - "products" → Products page header
 *   - "contact"  → Contact page header
 *   - "gallery"  → Gallery page header
 *
 * Soft delete:
 *   - `archivedAt` set when an admin "archives" a banner (hidden from public
 *      list but still visible in the admin panel under "Archive").
 *   - A hard-delete endpoint permanently removes the document and its image
 *      file from disk.
 */
export const BANNER_SECTIONS = ["landing", "about", "products", "contact", "gallery"] as const;
export type BannerSection = (typeof BANNER_SECTIONS)[number];

export const TEXT_ALIGN = ["left", "center", "right"] as const;
export type TextAlign = (typeof TEXT_ALIGN)[number];

export interface BannerTextStyle {
  /** Foreground colour for title text (any valid CSS colour string). */
  color?: string;
  /** Foreground colour for subtitle text. */
  subtitleColor?: string;
  /** Foreground colour for the eyebrow caption and its leading rule. */
  eyebrowColor?: string;
  /** Foreground colour for the title-accent line (second line of the heading). */
  titleAccentColor?: string;
  /** Text colour for the primary CTA button. */
  ctaPrimaryColor?: string;
  /** Background colour for the primary CTA button. */
  ctaPrimaryBg?: string;
  /** Text colour for the secondary CTA button (also used as its border colour). */
  ctaSecondaryColor?: string;
  /** Horizontal alignment of text within the banner. */
  align?: TextAlign;
  /** Opacity 0..1 of the dark overlay sat on top of the banner image. */
  overlayOpacity?: number;
  /** Heading font size in px or any css unit (e.g. "3rem"). */
  fontSize?: string;
  /** Heading font weight ("400" | "600" | "700"…). */
  fontWeight?: string;
  /** Optional background hex/CSS colour to render under the image. */
  background?: string;
}

export interface BannerDoc {
  section: BannerSection;
  title: string;
  /** Secondary accent line shown beneath the title in the hero, e.g. "From the Heart of Nepal." */
  titleAccent?: string;
  subtitle?: string;
  /** Small caption above the title, e.g. "From the Himalayas". */
  eyebrow?: string;
  /** Primary call-to-action label. */
  ctaLabel?: string;
  ctaHref?: string;
  /** Secondary CTA — pair of label + href. */
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
  /** Cloudinary public_id, stored under the landing-banners/about-banners/etc. subfolder. */
  imagePath?: string;
  imageUrl?: string;
  imageAlt?: string;
  /** Text style overrides. */
  style: BannerTextStyle;
  /** Sort order within its section (ascending). */
  sortOrder: number;
  /** Whether the banner appears on the public site. */
  isActive: boolean;
  /** Set when admin archives the banner. Excluded from public reads. */
  archivedAt?: Date;
  createdBy?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const styleSchema = new Schema<BannerTextStyle>(
  {
    color: { type: String, trim: true },
    subtitleColor: { type: String, trim: true },
    eyebrowColor: { type: String, trim: true },
    titleAccentColor: { type: String, trim: true },
    ctaPrimaryColor: { type: String, trim: true },
    ctaPrimaryBg: { type: String, trim: true },
    ctaSecondaryColor: { type: String, trim: true },
    align: { type: String, enum: TEXT_ALIGN, default: "left" },
    overlayOpacity: { type: Number, min: 0, max: 1, default: 0.35 },
    fontSize: { type: String, trim: true },
    fontWeight: { type: String, trim: true },
    background: { type: String, trim: true },
  },
  { _id: false },
);

const bannerSchema = new Schema<BannerDoc>(
  {
    section: { type: String, enum: BANNER_SECTIONS, required: true, index: true },
    title: { type: String, required: true, trim: true },
    titleAccent: { type: String, trim: true },
    subtitle: { type: String, trim: true },
    eyebrow: { type: String, trim: true },
    ctaLabel: { type: String, trim: true },
    ctaHref: { type: String, trim: true },
    ctaSecondaryLabel: { type: String, trim: true },
    ctaSecondaryHref: { type: String, trim: true },
    imagePath: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    imageAlt: { type: String, trim: true },
    style: { type: styleSchema, default: () => ({}) },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    archivedAt: { type: Date, default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true },
);

bannerSchema.index({ section: 1, sortOrder: 1, isActive: 1 });

export const BannerModel = model<BannerDoc>("Banner", bannerSchema);
export type BannerDocument = HydratedDocument<BannerDoc>;
