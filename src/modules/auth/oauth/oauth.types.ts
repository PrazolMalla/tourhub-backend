export const OAUTH_PROVIDERS = ["google", "facebook", "instagram", "tiktok"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export interface OAuthProfile {
  provider: OAuthProvider;
  /** Provider-issued stable user id (Google's `sub`, Facebook's `id`, etc.). */
  providerId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
}

export type OAuthErrorCode =
  | "missing_params"
  | "state_mismatch"
  | "provider_denied"
  | "code_exchange_failed"
  | "profile_fetch_failed"
  | "email_missing"
  | "blocked"
  | "unauthorized"
  | "inactive"
  | "internal";
