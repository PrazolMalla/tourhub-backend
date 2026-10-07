import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

const spec = z.object({
  icon: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(120),
});
const fact = z.object({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(120),
  icon: z.string().trim().min(1).max(40),
});

export class VehicleValidator {
  static readonly idParam = z
    .object({ id: z.string().regex(objectIdRegex, "Invalid id") })
    .strict();
  static readonly slugParam = z.object({ slug: z.string().trim().min(1).max(200) }).strict();

  static readonly create = z
    .object({
      slug: z
        .string()
        .trim()
        .max(200)
        .regex(/^[a-z0-9-]+$/i, "Slug may only contain letters, numbers and hyphens")
        .optional(),
      name: z.string().trim().min(1).max(200),
      tag: z.string().trim().max(120).optional(),
      desc: z.string().trim().max(2000).optional(),
      img: z.string().trim().max(1000).optional(),
      specs: z.array(spec).max(20).optional(),
      overview: z.array(z.string().trim().max(4000)).max(30).optional(),
      features: z.array(z.string().trim().max(500)).max(50).optional(),
      facts: z.array(fact).max(20).optional(),
      gallery: z.array(z.string().trim().max(1000)).max(30).optional(),
      isActive: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    })
    .strict();

  static readonly update = VehicleValidator.create
    .partial()
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });

  static readonly imageAltBody = z.object({ alt: z.string().trim().max(300) }).strict();
}
