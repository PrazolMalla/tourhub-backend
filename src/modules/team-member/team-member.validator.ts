import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

export class TeamMemberValidator {
  static readonly idParam = z
    .object({
      id: z.string().regex(objectIdRegex, "Invalid id"),
    })
    .strict();

  static readonly create = z
    .object({
      profilePhoto: z.string().trim().max(500).optional(), // image URL or uploaded file path

      name: z.string().trim().min(1).max(200),

      role: z.string().trim().min(1).max(150),

      location: z.string().trim().min(1).max(150).optional(),

      description: z.string().trim().min(1).max(5000),
    })
    .strict();

  static readonly update = z
    .object({
      profilePhoto: z.string().trim().max(500).optional(),

      name: z.string().trim().min(1).max(200).optional(),

      role: z.string().trim().min(1).max(150).optional(),

      location: z.string().trim().min(1).max(150).optional(),

      description: z.string().trim().min(1).max(5000).optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field required",
    });
}
