import { z } from "zod";
import { isSafeHref, SAFE_HREF_MESSAGE } from "../../core/utils/href.util";
import { booleanish } from "../../core/utils/zod.util";

const objectIdRegex = /^[a-f\d]{24}$/i;

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

const altitudeSchema = z
  .object({
    l: z.string().trim().min(1).max(120),
    m: z.coerce.number(),
  })
  .strict();

const itinSchema = z
  .object({
    d: z.string().trim().min(1).max(60),
    t: z.string().trim().min(1).max(200),
    b: z.string().trim().max(4_000).optional(),
    meta: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  })
  .strict();

const stringList = (max: number, itemMax = 2_000) =>
  stringOrJson(z.array(z.string().trim().min(1).max(itemMax)).max(max));

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

/**
 * Trip video link (YouTube/Vimeo/embed URL). An empty string clears it.
 * `z.url()` accepts any scheme (javascript:, data:, …), and this value is
 * embedded on the public trip page — so restrict it to safe links too.
 */
const videoUrl = z
  .string()
  .trim()
  .url("Invalid video URL")
  .max(500)
  .refine(isSafeHref, { message: SAFE_HREF_MESSAGE })
  .or(z.literal(""));

export class TripValidator {
  static readonly idParam = z
    .object({ id: z.string().regex(objectIdRegex, "Invalid id") })
    .strict();
  static readonly slugParam = z.object({ slug: z.string().trim().min(1).max(120) }).strict();

  static readonly create = z
    .object({
      title: z.string().trim().min(1).max(200),
      slug: optionalSlug(120),
      kind: z.enum(["trek", "tour"]),
      country: z.string().trim().min(1).max(120),
      region: z.string().trim().min(1).max(120),
      regionL: z.string().trim().max(200).optional(),
      cats: stringList(40, 80).optional(),
      days: z.coerce.number().nonnegative(),
      maxAlt: z.string().trim().max(60).optional(),
      diff: z.string().trim().max(60).optional(),
      season: z.string().trim().max(120).optional(),
      group: z.string().trim().max(60).optional(),
      price: z.string().trim().max(40).optional(),
      was: z.string().trim().max(40).optional(),
      rating: z.string().trim().max(20).optional(),
      reviews: z.string().trim().max(40).optional(),
      badge: z.string().trim().max(60).optional(),
      sub: z.string().trim().max(500).optional(),
      img: z.string().trim().max(500).optional(),
      overview: stringList(40).optional(),
      highlights: stringList(40).optional(),
      videoUrl: videoUrl.optional(),
      inc: stringList(60).optional(),
      exc: stringList(60).optional(),
      gallery: stringList(60, 500).optional(),
      altitude: stringOrJson(z.array(altitudeSchema).max(60)).optional(),
      itin: stringOrJson(z.array(itinSchema).max(60)).optional(),
      isActive: booleanish,
      isFeatured: booleanish,
    })
    .strict();

  static readonly update = z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      slug: optionalSlug(120),
      kind: z.enum(["trek", "tour"]).optional(),
      country: z.string().trim().min(1).max(120).optional(),
      region: z.string().trim().min(1).max(120).optional(),
      regionL: z.string().trim().max(200).optional(),
      cats: stringList(40, 80).optional(),
      days: z.coerce.number().nonnegative().optional(),
      maxAlt: z.string().trim().max(60).optional(),
      diff: z.string().trim().max(60).optional(),
      season: z.string().trim().max(120).optional(),
      group: z.string().trim().max(60).optional(),
      price: z.string().trim().max(40).optional(),
      was: z.string().trim().max(40).optional(),
      rating: z.string().trim().max(20).optional(),
      reviews: z.string().trim().max(40).optional(),
      badge: z.string().trim().max(60).optional(),
      sub: z.string().trim().max(500).optional(),
      img: z.string().trim().max(500).optional(),
      overview: stringList(40).optional(),
      highlights: stringList(40).optional(),
      videoUrl: videoUrl.optional(),
      inc: stringList(60).optional(),
      exc: stringList(60).optional(),
      gallery: stringList(60, 500).optional(),
      altitude: stringOrJson(z.array(altitudeSchema).max(60)).optional(),
      itin: stringOrJson(z.array(itinSchema).max(60)).optional(),
      isActive: booleanish,
      isFeatured: booleanish,
    })
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });

  static readonly imagePathBody = z.object({ path: z.string().trim().min(1).max(300) }).strict();

  static readonly imageReorderBody = z
    .object({
      order: z.array(z.string().trim().min(1).max(300)).min(1).max(50),
    })
    .strict();

  static readonly imageMetaBody = z
    .object({
      path: z.string().trim().min(1).max(300),
      alt: z.string().trim().max(300),
    })
    .strict();
}
