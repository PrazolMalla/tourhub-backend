import { z } from "zod";
import { BANNER_SECTIONS, TEXT_ALIGN } from "./banner.model";
import { isSafeHref, SAFE_HREF_MESSAGE } from "../../core/utils/href.util";

const styleSchema = z
  .object({
    color: z.string().trim().max(40).optional(),
    subtitleColor: z.string().trim().max(40).optional(),
    eyebrowColor: z.string().trim().max(40).optional(),
    titleAccentColor: z.string().trim().max(40).optional(),
    ctaPrimaryColor: z.string().trim().max(40).optional(),
    ctaPrimaryBg: z.string().trim().max(40).optional(),
    ctaSecondaryColor: z.string().trim().max(40).optional(),
    align: z.enum(TEXT_ALIGN).optional(),
    overlayOpacity: z.coerce.number().min(0).max(1).optional(),
    fontSize: z.string().trim().max(20).optional(),
    fontWeight: z.string().trim().max(10).optional(),
    background: z.string().trim().max(40).optional(),
  })
  .strict();

/**
 * Multipart-friendly: when the admin uploads an image alongside text fields,
 * everything arrives as strings. Coerce booleans/numbers and parse `style` if
 * it shows up as a JSON string.
 */
const optionalStyle = z
  .preprocess((val) => {
    if (typeof val === "string" && val.length > 0) {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  }, styleSchema.optional())
  .optional();

const boolish = z
  .preprocess((v) => {
    if (typeof v === "string") return v === "true";
    return v;
  }, z.boolean().optional())
  .optional();

const numish = z
  .preprocess((v) => {
    if (typeof v === "string" && v.length > 0) {
      const n = Number(v);
      return Number.isNaN(n) ? v : n;
    }
    return v;
  }, z.number().optional())
  .optional();

/**
 * sortOrder must be a non-negative integer. Coerces multipart string input.
 * Empty/absent → undefined (treated as "no change" on update / default on create).
 */
const sortOrderSchema = z
  .preprocess((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isNaN(n) ? v : n;
    }
    return v;
  }, z.number().int("sortOrder must be a whole number").min(0, "sortOrder cannot be negative").optional())
  .optional();

const hrefSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .refine(isSafeHref, { message: SAFE_HREF_MESSAGE });

export class BannerValidator {
  static readonly sectionParam = z.object({ section: z.enum(BANNER_SECTIONS) }).strict();

  static readonly idParam = z
    .object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id") })
    .strict();

  static readonly create = z
    .object({
      section: z.enum(BANNER_SECTIONS),
      title: z.string().trim().min(1).max(200),
      titleAccent: z.string().trim().max(200).optional(),
      subtitle: z.string().trim().max(600).optional(),
      eyebrow: z.string().trim().max(120).optional(),
      ctaLabel: z.string().trim().max(80).optional(),
      ctaHref: hrefSchema,
      ctaSecondaryLabel: z.string().trim().max(80).optional(),
      ctaSecondaryHref: hrefSchema,
      imageAlt: z.string().trim().max(200).optional(),
      style: optionalStyle,
      sortOrder: sortOrderSchema,
      isActive: boolish,
    })
    .strict();

  static readonly update = z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      titleAccent: z.string().trim().max(200).optional(),
      subtitle: z.string().trim().max(600).optional(),
      eyebrow: z.string().trim().max(120).optional(),
      ctaLabel: z.string().trim().max(80).optional(),
      ctaHref: hrefSchema,
      ctaSecondaryLabel: z.string().trim().max(80).optional(),
      ctaSecondaryHref: hrefSchema,
      imageAlt: z.string().trim().max(200).optional(),
      style: optionalStyle,
      sortOrder: sortOrderSchema,
      isActive: boolish,
    })
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });

  static readonly listQuery = z
    .object({
      section: z.enum(BANNER_SECTIONS).optional(),
      // Must match BannerState in banner.repository — an unknown state would
      // fall through to "no filter" and leak archived banners.
      state: z.enum(["live", "archived", "all"]).optional(),
    })
    .strict();
}
