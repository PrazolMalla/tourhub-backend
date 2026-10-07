import type { HydratedDocument } from "mongoose";
import type { SeoDoc, SeoEntityType, SeoImage, SeoRobots } from "./seo.model";

export type { SeoEntityType, SeoImage, SeoRobots };

/**
 * Fixed set of public routes that have no backing DB document. `entityId`
 * for `entityType: "static_page"` must be one of these keys. Kept in one
 * place so the backend validator, the admin "Static Pages" tab and the
 * frontend's `generateMetadata` calls can never drift apart.
 */
export const STATIC_PAGE_KEYS = [
  "home",
  "about",
  "contact",
  "tours",
  "blog",
  "holidays",
  "vehicles",
  "privacy",
  "terms",
] as const;
export type StaticPageKey = (typeof STATIC_PAGE_KEYS)[number];

export interface SeoDTO {
  id: string;
  entityType: SeoEntityType;
  entityId: string;
  metaTitle?: string;
  metaDescription?: string;
  keywords: string[];
  canonicalUrl?: string;
  robots: SeoRobots;
  /** Derived from `robots`, e.g. "index,follow" — never stored, always fresh. */
  robotsString: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: SeoImage;
  twitterCard: "summary" | "summary_large_image";
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: SeoImage;
  structuredDataEnabled: boolean;
  /** Per-page — when true, the public site's nav link to this page opens in a new tab. */
  openInNewTab: boolean;
  /** Internal completeness indicator only — NOT a ranking/algorithm score. */
  seoScore: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Text fields accept `null` to clear a previously-set value. */
export interface UpsertSeoInput {
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: string[];
  canonicalUrl?: string | null;
  robots?: Partial<SeoRobots>;
  ogTitle?: string | null;
  ogDescription?: string | null;
  twitterCard?: "summary" | "summary_large_image";
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  structuredDataEnabled?: boolean;
  openInNewTab?: boolean;
}

/** Builds the robots meta directive string from the friendly boolean toggles. */
export function computeRobotsString(robots: SeoRobots): string {
  const parts = [robots.index ? "index" : "noindex", robots.follow ? "follow" : "nofollow"];
  if (robots.noArchive) parts.push("noarchive");
  if (robots.noImageIndex) parts.push("noimageindex");
  if (robots.noSnippet) parts.push("nosnippet");
  return parts.join(",");
}

/**
 * Internal completeness heuristic (0–100) surfaced in the admin UI as
 * "SEO Health". This is NOT a model of any search engine's ranking
 * algorithm — it only reflects whether the recommended fields are filled in.
 */
export function computeSeoScore(doc: Pick<SeoDoc, keyof SeoDoc>): number {
  const checks: boolean[] = [
    !!doc.metaTitle && doc.metaTitle.length > 0,
    !!doc.metaTitle && doc.metaTitle.length >= 15 && doc.metaTitle.length <= 60,
    !!doc.metaDescription && doc.metaDescription.length > 0,
    !!doc.metaDescription && doc.metaDescription.length >= 50 && doc.metaDescription.length <= 160,
    !!doc.canonicalUrl,
    !!doc.ogImage?.url,
    !!(doc.ogImage?.alt && doc.ogImage.alt.length > 0),
    !!doc.ogTitle || !!doc.metaTitle,
    !!doc.ogDescription || !!doc.metaDescription,
    doc.structuredDataEnabled,
  ];
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}

export const toSeoDTO = (document: HydratedDocument<SeoDoc>): SeoDTO => {
  const dto: SeoDTO = {
    id: document._id.toString(),
    entityType: document.entityType,
    entityId: document.entityId,
    keywords: document.keywords ?? [],
    robots: document.robots,
    robotsString: computeRobotsString(document.robots),
    twitterCard: document.twitterCard,
    structuredDataEnabled: document.structuredDataEnabled,
    openInNewTab: document.openInNewTab,
    seoScore: computeSeoScore(document),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
  // `!= null` — cleared fields are stored as null and must read as "unset".
  if (document.metaTitle != null) dto.metaTitle = document.metaTitle;
  if (document.metaDescription != null) dto.metaDescription = document.metaDescription;
  if (document.canonicalUrl != null) dto.canonicalUrl = document.canonicalUrl;
  if (document.ogTitle != null) dto.ogTitle = document.ogTitle;
  if (document.ogDescription != null) dto.ogDescription = document.ogDescription;
  if (document.ogImage != null) dto.ogImage = document.ogImage;
  if (document.twitterTitle != null) dto.twitterTitle = document.twitterTitle;
  if (document.twitterDescription != null) dto.twitterDescription = document.twitterDescription;
  if (document.twitterImage != null) dto.twitterImage = document.twitterImage;
  return dto;
};

/** Default, empty-but-valid SEO shape — returned to the public site/admin when no record exists yet. */
export const emptySeoDTO = (entityType: SeoEntityType, entityId: string): SeoDTO => ({
  id: "default",
  entityType,
  entityId,
  keywords: [],
  robots: { index: true, follow: true, noArchive: false, noImageIndex: false, noSnippet: false },
  robotsString: "index,follow",
  twitterCard: "summary_large_image",
  structuredDataEnabled: true,
  openInNewTab: false,
  seoScore: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
