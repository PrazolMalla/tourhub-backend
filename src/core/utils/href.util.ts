/**
 * Allowed link schemes for admin-authored hrefs (CTA buttons, "explore" links):
 *   - relative paths starting with "/" (e.g. /products, /products?x=1) —
 *     but not "//" or "/\", which browsers treat as protocol-relative
 *     links to another host
 *   - relative hash links (e.g. #features)
 *   - http(s) absolute URLs
 *   - mailto: and tel: deep links
 * Anything else (`javascript:`, `data:`, `vbscript:`, file:, etc.) is rejected
 * to close the stored-XSS vector via clickable links.
 */
export const SAFE_HREF_RE =
  /^(\/(?![/\\])[^\s]*|#[^\s]*|https?:\/\/[^\s]+|mailto:[^\s]+|tel:[^\s]+)$/i;

export const SAFE_HREF_MESSAGE =
  "Link must start with /, #, http(s)://, mailto:, or tel: (no javascript:/data: URLs)";

/** Empty string counts as "no link". */
export const isSafeHref = (v: string | undefined): boolean =>
  v === undefined || v === "" || SAFE_HREF_RE.test(v);
