import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./_core/security";

describe("security response policy", () => {
  it("uses a nonce rather than permitting arbitrary inline scripts", () => {
    const policy = buildContentSecurityPolicy("test-nonce");
    expect(policy).toContain("script-src 'self' 'nonce-test-nonce'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'self'");
    expect(policy).toContain("img-src 'self' data: blob:");
    expect(policy).not.toContain("img-src 'self' data: https:");
    expect(policy).toContain("https://manus-analytics.com");
  });
});
