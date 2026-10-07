import { z } from "zod";
import { isSafeHref, SAFE_HREF_MESSAGE } from "../../core/utils/href.util";
import { booleanish } from "../../core/utils/zod.util";

const objectIdRegex = /^[a-f\d]{24}$/i;

const safeHref = z
  .string()
  .trim()
  .max(500)
  .optional()
  .refine(isSafeHref, { message: SAFE_HREF_MESSAGE });

const stringOrJson = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => {
    if (typeof v === "string" && (v.startsWith("[") || v.startsWith("{"))) {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    }
    return v;
  }, inner);

const relatedSchema = z
  .object({
    slug: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(200),
  })
  .strict();

/**
 * Optional slug: an empty string is treated as "not provided" (server
 * auto-generates). NOTE: `.optional()` must wrap the `.or()` pipe from the
 * outside — nesting it inside a preprocess/effects pipe hides the
 * "optional" marker from Zod's object-shape check, so a genuinely missing
 * key gets rejected as required. Mirrors the frontend's `optionalSlugSchema`
 * (admin-panel/src/schemas/common.schema.ts).
 */
const optionalSlug = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export class BlogValidator {
  static readonly idParam = z
    .object({ id: z.string().regex(objectIdRegex, "Invalid id") })
    .strict();
  static readonly slugParam = z.object({ slug: z.string().trim().min(1).max(120) }).strict();

  static readonly create = z
    .object({
      title: z.string().trim().min(1).max(200),
      slug: optionalSlug(120),
      description: z.string().trim().max(500).optional(),
      category: z.string().trim().max(80).optional(),
      dateLabel: z.string().trim().max(60).optional(),
      datePublished: z.coerce.date().optional(),
      readTime: z.string().trim().max(40).optional(),
      heroAlt: z.string().trim().max(200).optional(),
      heroImage: z.string().trim().max(500).url("Must be a valid URL").optional(),
      body: z.string().min(1).max(200_000),
      excerpt: z.string().trim().max(1_000).optional(),
      exploreText: z.string().trim().max(120).optional(),
      exploreHref: safeHref,
      featured: booleanish,
      related: stringOrJson(z.array(relatedSchema).max(12)).optional(),
      isActive: booleanish,
    })
    .strict();

  static readonly update = z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      slug: optionalSlug(120),
      description: z.string().trim().max(500).optional(),
      category: z.string().trim().max(80).optional(),
      dateLabel: z.string().trim().max(60).optional(),
      datePublished: z.coerce.date().optional(),
      readTime: z.string().trim().max(40).optional(),
      heroAlt: z.string().trim().max(200).optional(),
      heroImage: z.string().trim().max(500).url("Must be a valid URL").or(z.literal("")).optional(),
      body: z.string().min(1).max(200_000).optional(),
      excerpt: z.string().trim().max(1_000).optional(),
      exploreText: z.string().trim().max(120).optional(),
      exploreHref: safeHref,
      featured: booleanish,
      related: stringOrJson(z.array(relatedSchema).max(12)).optional(),
      isActive: booleanish,
    })
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });

  static readonly imagePathBody = z.object({ path: z.string().trim().min(1).max(300) }).strict();

  static readonly imageMetaBody = z
    .object({
      path: z.string().trim().min(1).max(300),
      alt: z.string().trim().max(300),
    })
    .strict();
}
