import type { OAuthProfile, OAuthTokenResponse } from "./oauth.types";

/**
 * Abstract OAuth 2.0 service. Concrete subclasses provide the four URLs
 * (authorize/token/profile) plus a `parseProfile` mapping from the provider's
 * raw response to our unified `OAuthProfile` shape.
 */
export abstract class BaseOAuthService {
  abstract readonly authorizeUrl: string;
  abstract readonly tokenUrl: string;
  abstract readonly profileUrl: string;
  abstract readonly scope: string;

  constructor(
    public readonly clientId: string,
    public readonly clientSecret: string,
    public readonly callbackUrl: string,
  ) {}

  /** Build the URL the browser is redirected to so the user can authorize the app. */
  buildAuthorizeUrl(state: string, extraParams: Record<string, string> = {}): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      response_type: "code",
      scope: this.scope,
      state,
      ...extraParams,
    });
    return `${this.authorizeUrl}?${params.toString()}`;
  }

  /** Exchange the authorization code for an access token at the provider's token endpoint. */
  async exchangeCode(code: string): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.callbackUrl,
      grant_type: "authorization_code",
    });
    const res = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OAuth code exchange failed (${res.status}): ${text}`);
    }
    return (await res.json()) as OAuthTokenResponse;
  }

  /** Fetch the user's profile using the access token; subclasses parse the raw response. */
  async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const res = await fetch(this.profileUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OAuth profile fetch failed (${res.status}): ${text}`);
    }
    return this.parseProfile(await res.json());
  }

  protected abstract parseProfile(raw: unknown): OAuthProfile;
}
