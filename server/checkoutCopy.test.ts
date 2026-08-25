import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("customer-facing checkout copy", () => {
  it("does not expose an internal request-test label in the order summary", () => {
    const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    expect(css).toContain('.checkout-summary::before { content: "Обобщение на заявката"; text-transform: uppercase; }');
    expect(css).toContain('html[lang="en"] .checkout-summary::before { content: "REQUEST SUMMARY"; }');
    expect(css).not.toContain("REQ—TEST");
  });
});
