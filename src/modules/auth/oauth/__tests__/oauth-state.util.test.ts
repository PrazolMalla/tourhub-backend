import { issueOAuthState, verifyOAuthState } from "../oauth-state.util";

const SECRET = "a".repeat(32);

describe("oauth-state.util", () => {
  it("issued state verifies against its own cookie", () => {
    const { state, cookie } = issueOAuthState(SECRET);
    expect(verifyOAuthState(SECRET, state, cookie)).toBe(true);
  });

  it("each issuance returns unique nonces", () => {
    const a = issueOAuthState(SECRET);
    const b = issueOAuthState(SECRET);
    expect(a.state).not.toBe(b.state);
  });

  it("rejects when cookie is missing", () => {
    const { state } = issueOAuthState(SECRET);
    expect(verifyOAuthState(SECRET, state, undefined)).toBe(false);
    expect(verifyOAuthState(SECRET, state, "")).toBe(false);
  });

  it("rejects when state is empty", () => {
    const { cookie } = issueOAuthState(SECRET);
    expect(verifyOAuthState(SECRET, "", cookie)).toBe(false);
  });

  it("rejects when cookie has wrong format", () => {
    const { state } = issueOAuthState(SECRET);
    expect(verifyOAuthState(SECRET, state, "no-dot-in-here")).toBe(false);
    expect(verifyOAuthState(SECRET, state, "too.many.dots.here")).toBe(false);
  });

  it("rejects when nonce in cookie doesn't match URL state", () => {
    const a = issueOAuthState(SECRET);
    const b = issueOAuthState(SECRET);
    expect(verifyOAuthState(SECRET, a.state, b.cookie)).toBe(false);
  });

  it("rejects when signature is tampered", () => {
    const { state, cookie } = issueOAuthState(SECRET);
    const [nonce] = cookie.split(".");
    expect(verifyOAuthState(SECRET, state, `${nonce}.deadbeef`)).toBe(false);
  });

  it("rejects when verified with a different secret", () => {
    const { state, cookie } = issueOAuthState(SECRET);
    expect(verifyOAuthState("b".repeat(32), state, cookie)).toBe(false);
  });
});
