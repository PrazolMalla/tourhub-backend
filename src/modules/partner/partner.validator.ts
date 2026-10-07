import { z } from "zod";
import { isSafeHref, SAFE_HREF_MESSAGE } from "../../core/utils/href.util";

const objectIdRegex = /^[a-f\d]{24}$/i;

/** Rendered as a clickable link on the public site — block javascript:/data: URLs. */
const safeUrl = z.string().trim().max(500).optional().refine(isSafeHref, {
  message: SAFE_HREF_MESSAGE,
});

export class PartnerValidator {
  static readonly idParam = z
    .object({ id: z.string().regex(objectIdRegex, "Invalid id") })
    .strict();

  static readonly create = z
    .object({
      name: z.string().trim().min(1).max(120),
      url: safeUrl,
      logoUrl: safeUrl,
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    })
    .strict();

  static readonly update = z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      url: safeUrl,
      logoUrl: safeUrl,
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    })
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });
}
