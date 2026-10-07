import { z } from "zod";
import { SEO_ENTITY_TYPES } from "./seo.model";
import { STATIC_PAGE_KEYS } from "./seo.types";

const objectIdRegex = /^[a-f\d]{24}$/i;
const staticPageKeySet = new Set<string>(STATIC_PAGE_KEYS);

/**
 * Optional URL: empty string means "clear it" (falls back to the computed
 * canonical). Mapped to `null` — not `undefined` — so the service actually
 * writes the clear instead of skipping the field.
 */
const optionalUrl = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" ? null : v));

const robotsBody = z
  .object({
    index: z.boolean().optional(),
    follow: z.boolean().optional(),
    noArchive: z.boolean().optional(),
    noImageIndex: z.boolean().optional(),
    noSnippet: z.boolean().optional(),
  })
  .strict();

export class SeoValidator {
  /**
   * `entityId` is either a Mongo ObjectId (trip/blog/holiday/vehicle) or a
   * fixed static-page key — validated together so a typo'd static page key
   * fails fast instead of silently creating an orphan record.
   */
  static readonly entityParam = z
    .object({
      entityType: z.enum(SEO_ENTITY_TYPES),
      entityId: z.string().trim().min(1).max(100),
    })
    .strict()
    .refine((v) => v.entityType !== "static_page" || staticPageKeySet.has(v.entityId), {
      message: `entityId must be one of: ${STATIC_PAGE_KEYS.join(", ")} for entityType "static_page"`,
      path: ["entityId"],
    })
    .refine((v) => v.entityType === "static_page" || objectIdRegex.test(v.entityId), {
      message: "entityId must be a valid id",
      path: ["entityId"],
    });

  static readonly listQuery = z
    .object({
      entityType: z.enum(SEO_ENTITY_TYPES).optional(),
    })
    .strict();

  static readonly upsert = z
    .object({
      metaTitle: z.string().trim().max(70).or(z.literal("")).optional(),
      metaDescription: z.string().trim().max(300).or(z.literal("")).optional(),
      keywords: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
      canonicalUrl: optionalUrl(500),
      robots: robotsBody.optional(),
      ogTitle: z.string().trim().max(70).or(z.literal("")).optional(),
      ogDescription: z.string().trim().max(300).or(z.literal("")).optional(),
      twitterCard: z.enum(["summary", "summary_large_image"]).optional(),
      twitterTitle: z.string().trim().max(70).or(z.literal("")).optional(),
      twitterDescription: z.string().trim().max(300).or(z.literal("")).optional(),
      structuredDataEnabled: z.boolean().optional(),
      openInNewTab: z.boolean().optional(),
    })
    .strict()
    // "" from a cleared form field → null (explicit clear). Absent keys stay
    // undefined (left untouched). Mapping "" to undefined made it impossible
    // to ever remove a value once set.
    .transform((v) => {
      const clear = (s: string | undefined) => (s === "" ? null : s);
      return {
        ...v,
        metaTitle: clear(v.metaTitle),
        metaDescription: clear(v.metaDescription),
        ogTitle: clear(v.ogTitle),
        ogDescription: clear(v.ogDescription),
        twitterTitle: clear(v.twitterTitle),
        twitterDescription: clear(v.twitterDescription),
      };
    });

  static readonly imageAlt = z
    .object({
      alt: z.string().trim().max(200).optional(),
    })
    .strict();
}
