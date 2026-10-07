import { HttpError } from "../errors/http.error";

/**
 * URL-safe slug from any human string. Shared by every content module so
 * slugging stays identical across treks, tours, blog posts, regions, etc.
 */
export const slugify = (input: string): string =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

/**
 * Slugify and reject an empty result. Titles written only in non-Latin script
 * (e.g. Devanagari) or only punctuation slugify to "", which would otherwise
 * surface as a Mongoose "slug is required" 500 or silently store an empty slug.
 */
export const requireSlug = (input: string): string => {
  const slug = slugify(input);
  if (!slug) {
    throw HttpError.badRequest("Could not derive a URL slug — provide a slug using a-z, 0-9 or -");
  }
  return slug;
};
