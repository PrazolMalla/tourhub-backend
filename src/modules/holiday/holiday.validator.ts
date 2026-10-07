import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

const faq = z.object({
  q: z.string().trim().min(1).max(500),
  a: z.string().trim().min(1).max(4000),
});

/** Invalid dates must never reach Mongo — the public serializer calls toISOString() on them. */
const dateField = z.coerce.date();

const endNotBeforeStart = (d: { startDate?: Date | undefined; endDate?: Date | undefined }) =>
  !d.startDate || !d.endDate || d.endDate.getTime() >= d.startDate.getTime();
const END_BEFORE_START = { message: "endDate must be on or after startDate", path: ["endDate"] };

const fields = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .max(200)
    .regex(/^[a-z0-9-]+$/i, "Slug may only contain letters, numbers and hyphens")
    .optional(),
  description: z.string().trim().max(2000).optional(),
  startDate: dateField,
  endDate: dateField,
  bannerImage: z.string().trim().max(1000).optional(),
  discountPercentage: z.coerce.number().min(0).max(100).optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  seoTitle: z.string().trim().max(300).optional(),
  seoDescription: z.string().trim().max(600).optional(),
  seoKeywords: z.array(z.string().trim().max(120)).max(50).optional(),
  recommendedTreks: z.array(z.string().trim().max(200)).max(50).optional(),
  regions: z.array(z.string().trim().max(120)).max(50).optional(),
  body: z.array(z.string().trim().max(6000)).max(50).optional(),
  faqs: z.array(faq).max(50).optional(),
  sortOrder: z.number().int().optional(),
});

export class HolidayValidator {
  static readonly idParam = z
    .object({ id: z.string().regex(objectIdRegex, "Invalid id") })
    .strict();

  static readonly slugParam = z.object({ slug: z.string().trim().min(1).max(200) }).strict();

  static readonly create = fields.strict().refine(endNotBeforeStart, END_BEFORE_START);

  // Built from the base shape — Zod 4 refuses `.partial()` on a refined schema.
  static readonly update = fields
    .partial()
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: "At least one field required" })
    .refine(endNotBeforeStart, END_BEFORE_START);

  static readonly imageAltBody = z.object({ alt: z.string().trim().max(300) }).strict();
}
