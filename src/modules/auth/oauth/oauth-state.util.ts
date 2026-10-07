import crypto from "node:crypto";

export const OAUTH_STATE_COOKIE_NAME = "oauth_state";
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Issue an OAuth state token.
 *  - The `state` value goes on the URL (sent to the provider).
 *  - The `cookie` value is set on the user's browser; it carries the state
 *    plus an HMAC signature so we can detect tampering.
 *
 * On the callback, the cookie's nonce must equal the URL state, AND the
 * cookie's signature must verify against the same secret. This binds the
 * callback to the original session that initiated the flow.
 */
export const issueOAuthState = (secret: string): { state: string; cookie: string } => {
  const nonce = crypto.randomBytes(16).toString("hex");
  const signature = crypto.createHmac("sha256", secret).update(nonce).digest("hex");
  return { state: nonce, cookie: `${nonce}.${signature}` };
};

/**
 * Verify an OAuth callback state against the cookie. Returns true iff:
 *  1. The cookie has the form `<nonce>.<signature>`.
 *  2. The cookie nonce equals the URL state.
 *  3. The signature is a valid HMAC of the nonce with the same secret.
 */
export const verifyOAuthState = (
  secret: string,
  state: string,
  cookie: string | undefined,
): boolean => {
  if (!cookie || !state) return false;
  const parts = cookie.split(".");
  if (parts.length !== 2) return false;
  const [cookieNonce, cookieSig] = parts;
  if (!cookieNonce || !cookieSig) return false;
  if (cookieNonce !== state) return false;

  const expected = crypto.createHmac("sha256", secret).update(cookieNonce).digest("hex");
  if (expected.length !== cookieSig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(cookieSig));
};
