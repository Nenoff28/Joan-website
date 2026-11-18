import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("customer-facing checkout copy", () => {
  it("does not expose an internal request-test label in the order summary", () => {
    const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    // The summary already shows t("orderSummary"); a CSS-generated label above it duplicated the heading.
    expect(css).toContain(".checkout-summary::before { content: none; }");
    expect(css).not.toContain('content: "Обобщение на заявката"');
    expect(css).not.toContain("REQ—TEST");
  });
});
