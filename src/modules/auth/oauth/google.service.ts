import { BaseOAuthService } from "./base-oauth.service";
import type { OAuthProfile } from "./oauth.types";

interface GoogleUserInfo {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export class GoogleOAuthService extends BaseOAuthService {
  readonly authorizeUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  readonly tokenUrl = "https://oauth2.googleapis.com/token";
  readonly profileUrl = "https://www.googleapis.com/oauth2/v3/userinfo";
  readonly scope = "openid email profile";

  protected parseProfile(raw: unknown): OAuthProfile {
    const r = (raw ?? {}) as GoogleUserInfo;
    if (!r.sub) {
      throw new Error("Google profile missing 'sub' field");
    }
    if (!r.email) {
      throw new Error("Google profile missing 'email' field");
    }
    // Accounts are linked by email, so an unverified address would let
    // someone claim an existing (possibly admin) account. Require Google's
    // explicit verification.
    if (r.email_verified !== true) {
      throw new Error("Google account email is not verified");
    }

    const profile: OAuthProfile = {
      provider: "google",
      providerId: r.sub,
      email: r.email,
    };
    if (r.name) profile.name = r.name;
    if (r.picture) profile.avatarUrl = r.picture;
    return profile;
  }
}
