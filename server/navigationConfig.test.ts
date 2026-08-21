import { describe, expect, it } from "vitest";

describe("navigation refinement configuration", () => {
  it("can reach the storefront endpoint while forwarding the configured navigation flag", async () => {
    const configuredFlag = process.env.NAVIGATION_REFINEMENT_NOT_REQUIRED;
    expect(configuredFlag).toBe("not-used");
    const response = await fetch("http://localhost:3000/", { headers: { "x-navigation-refinement": configuredFlag } });
    expect(response.ok).toBe(true);
  });
});
