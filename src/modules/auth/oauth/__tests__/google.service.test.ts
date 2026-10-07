import { GoogleOAuthService } from "../google.service";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const ok = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });

const fail = (status: number, body: string) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
  });

describe("GoogleOAuthService", () => {
  const service = new GoogleOAuthService("client-id", "client-secret", "https://app/cb");

  beforeEach(() => mockFetch.mockReset());

  describe("buildAuthorizeUrl", () => {
    it("includes the standard OAuth params + state", () => {
      const url = service.buildAuthorizeUrl("nonce-123");
      expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth?");
      expect(url).toContain("client_id=client-id");
      expect(url).toContain("redirect_uri=https%3A%2F%2Fapp%2Fcb");
      expect(url).toContain("response_type=code");
      expect(url).toContain("scope=openid+email+profile");
      expect(url).toContain("state=nonce-123");
    });
  });

  describe("exchangeCode", () => {
    it("POSTs to the token endpoint and returns parsed JSON", async () => {
      mockFetch.mockReturnValueOnce(ok({ access_token: "ya29.x", expires_in: 3599 }));
      const tokens = await service.exchangeCode("auth-code");
      expect(tokens.access_token).toBe("ya29.x");
      const [url, init] = mockFetch.mock.calls[0]!;
      expect(url).toBe("https://oauth2.googleapis.com/token");
      expect(init.method).toBe("POST");
      expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
      expect(init.body).toContain("code=auth-code");
      expect(init.body).toContain("grant_type=authorization_code");
    });

    it("throws when the token endpoint returns 4xx", async () => {
      mockFetch.mockReturnValueOnce(fail(400, "invalid_grant"));
      await expect(service.exchangeCode("bad")).rejects.toThrow(/code exchange failed/i);
    });
  });

  describe("fetchProfile", () => {
    it("fetches /userinfo with bearer auth and parses the response", async () => {
      mockFetch.mockReturnValueOnce(
        ok({
          sub: "1098",
          email: "alice@example.com",
          email_verified: true,
          name: "Alice",
          picture: "https://x/p",
        }),
      );
      const profile = await service.fetchProfile("ya29.x");
      expect(profile).toEqual({
        provider: "google",
        providerId: "1098",
        email: "alice@example.com",
        name: "Alice",
        avatarUrl: "https://x/p",
      });
      const [url, init] = mockFetch.mock.calls[0]!;
      expect(url).toBe("https://www.googleapis.com/oauth2/v3/userinfo");
      expect(init.headers.Authorization).toBe("Bearer ya29.x");
    });

    it("throws when /userinfo returns 4xx", async () => {
      mockFetch.mockReturnValueOnce(fail(401, "expired"));
      await expect(service.fetchProfile("bad")).rejects.toThrow(/profile fetch failed/i);
    });

    it("throws when sub is missing", async () => {
      mockFetch.mockReturnValueOnce(ok({ email: "x@y" }));
      await expect(service.fetchProfile("ya29.x")).rejects.toThrow(/missing 'sub'/);
    });

    it("throws when email is missing", async () => {
      mockFetch.mockReturnValueOnce(ok({ sub: "1098" }));
      await expect(service.fetchProfile("ya29.x")).rejects.toThrow(/missing 'email'/);
    });

    it.each([false, undefined])(
      "rejects an unverified Google email (email_verified=%p) — accounts are linked by email",
      async (email_verified) => {
        mockFetch.mockReturnValueOnce(
          ok({ sub: "1098", email: "admin@example.com", email_verified }),
        );
        await expect(service.fetchProfile("ya29.x")).rejects.toThrow(/not verified/);
      },
    );

    it("omits name and avatarUrl when not present", async () => {
      mockFetch.mockReturnValueOnce(ok({ sub: "1098", email: "x@y", email_verified: true }));
      const profile = await service.fetchProfile("ya29.x");
      expect(profile).toEqual({
        provider: "google",
        providerId: "1098",
        email: "x@y",
      });
    });
  });
});
