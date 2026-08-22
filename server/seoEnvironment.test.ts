import { describe, expect, it } from "vitest";

describe("SEO environment configuration", () => {
  it("uses a reachable HTTPS canonical origin", async () => {
    const origin = process.env.CANONICAL_ORIGIN;
    expect(origin).toBeTruthy();
    const url = new URL(origin!);
    expect(url.protocol).toBe("https:");
    const response = await fetch(url, { method: "HEAD", redirect: "manual" });
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(400);
  }, 15_000);
});
