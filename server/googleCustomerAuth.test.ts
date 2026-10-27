import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { getCustomerSessionSigningKey } from "./customerAccounts";
import {
  DEFAULT_GOOGLE_REDIRECT_URI,
  GOOGLE_CUSTOMER_SCOPES,
  GOOGLE_STATE_COOKIE,
  getGoogleCustomerAuthConfig,
  getGoogleCustomerAuthStatus,
  isSafeGoogleRedirectUri,
  startGoogleCustomerAuth,
} from "./googleCustomerAuth";

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Google customer OIDC configuration", () => {
  it("is disabled without credentials and exposes no secret", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    const status = getGoogleCustomerAuthStatus();
    expect(status.configured).toBe(false);
    expect(status.redirectUri).toBe(DEFAULT_GOOGLE_REDIRECT_URI);
    expect(status.scopes).toEqual(GOOGLE_CUSTOMER_SCOPES);
    expect(JSON.stringify(status)).not.toContain("SECRET");
  });

  it("accepts only the fixed callback path and safe HTTPS redirect form", () => {
    expect(isSafeGoogleRedirectUri(DEFAULT_GOOGLE_REDIRECT_URI)).toBe(true);
    expect(isSafeGoogleRedirectUri("https://evil.example/callback")).toBe(false);
    expect(isSafeGoogleRedirectUri(`${DEFAULT_GOOGLE_REDIRECT_URI}?next=https://evil.example`)).toBe(false);
    expect(isSafeGoogleRedirectUri("https://user:pass@joanredesign-gcqdscde.manus.space/api/customer/google/callback")).toBe(false);
  });

  it("creates a short-lived signed HttpOnly state cookie and S256 authorization request", async () => {
    process.env.JWT_SECRET = "test-only-session-secret";
    process.env.GOOGLE_CLIENT_ID = "client-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "test-only-client-secret";
    delete process.env.GOOGLE_REDIRECT_URI;
    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const response = { cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }) };
    const authorizationUrl = await startGoogleCustomerAuth(response as never);
    const parsed = new URL(authorizationUrl);
    expect(parsed.origin).toBe("https://accounts.google.com");
    expect(parsed.pathname).toBe("/o/oauth2/v2/auth");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toBe("openid email profile");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("state")).toBeTruthy();
    expect(parsed.searchParams.get("nonce")).toBeTruthy();
    expect(parsed.searchParams.get("code_challenge")).toBeTruthy();
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({ name: GOOGLE_STATE_COOKIE, options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" } });
    expect(cookies[0]?.value).not.toContain("test-only-client-secret");
    expect(getCustomerSessionSigningKey()).toBeInstanceOf(Uint8Array);
  });

  it("uses the dedicated customer session secret when it is configured", () => {
    const legacySecret = "legacy";
    const customerSecret = "customer";
    process.env.JWT_SECRET = legacySecret;
    process.env.JOAN_CUSTOMER_SESSION_SECRET = customerSecret;

    const expected = createHash("sha256")
      .update(`joan-customer-session:${customerSecret}`)
      .digest();

    expect(Buffer.from(getCustomerSessionSigningKey())).toEqual(expected);
  });
});
