import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

export class UserValidator {
  static readonly idParam = z
    .object({
      id: z.string().regex(objectIdRegex, "Invalid id"),
    })
    .strict();

  static readonly create = z
    .object({
      email: z.email("Invalid email"),
      password: z.string().min(8, "Password must be at least 8 characters"),
      name: z.string().trim().min(1).optional(),
      phone: z.string().trim().min(7).max(20).optional(),
    })
    .strict();

  static readonly update = z
    .object({
      name: z.string().trim().min(1).optional(),
      isActive: z.boolean().optional(),
      phone: z.string().trim().min(7).max(20).optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: "Update payload must contain at least one field",
    });

  static readonly ban = z
    .object({
      reason: z.string().trim().min(1).max(500).optional(),
    })
    .strict();
}
