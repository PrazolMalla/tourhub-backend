import { z } from "zod";

const objectId = /^[a-f\d]{24}$/i;

// International-friendly: optional leading +, 7-15 digits, spaces/dashes allowed.
const PHONE_REGEX = /^\+?[0-9](?:[0-9\s-]{5,17})[0-9]$/;

/**
 * `z.coerce.boolean()` is just `Boolean(x)` under the hood, so the string
 * "false" (as sent by multipart/form-data, which has no real boolean type)
 * would coerce to `true`. This treats "false"/"0"/"" as false, everything
 * else truthy — safe for both real booleans (JSON) and stringified ones
 * (multipart create).
 */
const booleanish = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  return !["false", "0", ""].includes(v.toLowerCase());
}, z.boolean());

export class SchoolTripChecklistValidator {
  static readonly idParam = z.object({ id: z.string().regex(objectId, "Invalid id") }).strict();

  static readonly create = z
    .object({
      type: z.string().trim().min(2, "Type is required").max(120),
      isActive: booleanish.optional(),
      sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    })
    .strict();

  static readonly update = z
    .object({
      type: z.string().trim().min(2).max(120).optional(),
      isActive: booleanish.optional(),
      sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    })
    .strict()
    .refine((d) => Object.keys(d).length > 0, {
      message: "Update payload must contain at least one field",
    });

  static readonly download = z
    .object({
      name: z.string().trim().min(2, "Please enter your name").max(120),
      phone: z
        .string()
        .trim()
        .regex(PHONE_REGEX, "Enter a valid phone number")
        .min(7, "Enter a valid phone number")
        .max(20, "Enter a valid phone number"),
    })
    .strict();
}
