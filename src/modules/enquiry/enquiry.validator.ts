import { z } from "zod";
import { booleanish } from "../../core/utils/zod.util";

const objectIdRegex = /^[a-f\d]{24}$/i;

const STATUSES = ["new", "contacted", "converted", "closed", "spam"] as const;

export class EnquiryValidator {
  static readonly idParam = z
    .object({ id: z.string().regex(objectIdRegex, "Invalid id") })
    .strict();

  static readonly create = z
    .object({
      name: z.string().trim().max(200).optional(),
      // Allow a valid email OR an empty string (forms often submit blanks).
      email: z.union([z.email(), z.literal("")]).optional(),
      phone: z.string().trim().max(50).optional(),
      people: z.string().trim().max(50).optional(),
      trip: z.string().trim().max(200).optional(),
      date: z.string().trim().max(120).optional(),
      message: z.string().trim().max(5000).optional(),
      source: z.string().trim().min(1).max(60),
    })
    .strict()
    .refine((d) => Boolean(d.name || d.email || d.phone), {
      message: "At least one of name, email or phone is required",
    });

  static readonly update = z
    .object({
      status: z.enum(STATUSES).optional(),
      adminNotes: z.string().trim().max(5000).optional(),
      newNote: z.string().trim().min(1).max(5000).optional(),
      isRead: booleanish,
    })
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });
}
