import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

/**
 * Optional slug: an empty string is treated as "not provided" (server
 * auto-generates). NOTE: `.optional()` must wrap the `z.preprocess`/`.or()`
 * pipe from the outside — nesting it inside a preprocess/effects pipe hides
 * the "optional" marker from Zod's object-shape check, so a genuinely
 * missing key gets rejected as required. Mirrors the frontend's
 * `optionalSlugSchema` (admin-panel/src/schemas/common.schema.ts).
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

export class RegionValidator {
  static readonly idParam = z
    .object({ id: z.string().regex(objectIdRegex, "Invalid id") })
    .strict();
  static readonly slugParam = z.object({ slug: z.string().trim().min(1).max(80) }).strict();

  static readonly create = z
    .object({
      name: z.string().trim().min(1).max(120),
      slug: optionalSlug(80),
      key: z.string().trim().min(1).max(80),
      type: z.enum(["trek-region", "tour-category"]).optional(),
      longLabel: z.string().trim().max(200).optional(),
      description: z.string().trim().max(1000).optional(),
      imageUrl: z.string().trim().max(500).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    })
    .strict();

  static readonly update = z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      slug: optionalSlug(80),
      key: z.string().trim().min(1).max(80).optional(),
      type: z.enum(["trek-region", "tour-category"]).optional(),
      longLabel: z.string().trim().max(200).optional(),
      description: z.string().trim().max(1000).optional(),
      imageUrl: z.string().trim().max(500).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    })
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });
}
