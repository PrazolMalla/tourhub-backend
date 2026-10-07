import { z } from "zod";

/**
 * Optional boolean that also accepts the strings "true" / "false" (multipart
 * forms and query strings send everything as text).
 *
 * Why not `z.coerce.boolean()`: it is `Boolean(x)` under the hood, so the
 * string "false" becomes `true` — any non-empty string is truthy.
 */
export const booleanish = z
  .preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean())
  .optional();
