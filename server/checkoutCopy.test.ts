import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("customer-facing checkout copy", () => {
  it("does not expose an internal request-test label in the order summary", () => {
    const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    const finalSummaryRule = css.slice(css.lastIndexOf(".checkout-summary::before"));
    expect(finalSummaryRule).toContain('content: "Обобщение на заявката"');
    expect(finalSummaryRule).not.toContain("REQ—TEST");
  });
});
