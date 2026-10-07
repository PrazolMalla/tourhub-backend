import { z } from "zod";

/**
 * Section keys are lowercase, hyphen/underscore allowed, 1–40 chars. Open-ended
 * so admin can introduce new sections without a code change.
 */
const sectionKey = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, "Section must be alphanumeric with - or _");

export class SiteContentValidator {
  static readonly sectionParam = z.object({ section: sectionKey }).strict();

  static readonly upsert = z
    .object({
      data: z.record(z.string(), z.unknown()).optional(),
      isPublished: z.boolean().optional(),
      notes: z.string().trim().max(2000).optional(),
    })
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });

  static readonly reorder = z
    .object({
      order: z.array(z.string().min(1)).min(1).max(50),
    })
    .strict();

  static readonly imageMeta = z
    .object({
      imagePath: z.string().min(1).max(300),
      alt: z.string().trim().max(200).optional(),
      caption: z.string().trim().max(500).optional(),
    })
    .strict();

  static readonly removeImage = z
    .object({
      imagePath: z.string().min(1).max(300),
    })
    .strict();
}
