import { z } from "zod";
import { isSafeHref, SAFE_HREF_MESSAGE } from "../../core/utils/href.util";

const objectIdRegex = /^[a-f\d]{24}$/i;
const SourceEnum = z.enum(["google", "trip advisor"]);

/** Rendered as an <img>/<video>/<iframe> src on the public site — block javascript:/data: URLs. */
const safeUrl = z.string().trim().max(500).optional().refine(isSafeHref, {
  message: SAFE_HREF_MESSAGE,
});
export class TestimonialValidator {
  static readonly idParam = z
    .object({ id: z.string().regex(objectIdRegex, "Invalid id") })
    .strict();

  static readonly create = z
    .object({
      name: z.string().trim().min(1).max(120),
      location: z.string().trim().max(120).optional(),
      role: z.string().trim().max(120).optional(),
      rating: z.coerce.number().min(1).max(5).optional(),
      quote: z.string().trim().min(1).max(2000),
      tripTitle: z.string().trim().max(200).optional(),
      avatarUrl: safeUrl,
      isActive: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
      videoUrl: safeUrl,
      source: SourceEnum.optional(),
    })
    .strict();

  static readonly update = z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      location: z.string().trim().max(120).optional(),
      role: z.string().trim().max(120).optional(),
      rating: z.coerce.number().min(1).max(5).optional(),
      quote: z.string().trim().min(1).max(2000).optional(),
      tripTitle: z.string().trim().max(200).optional(),
      avatarUrl: safeUrl,
      isActive: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
      videoUrl: safeUrl,
      source: SourceEnum.optional(),
    })
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });
}
