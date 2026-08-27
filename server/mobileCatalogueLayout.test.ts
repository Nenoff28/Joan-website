import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "client/src/components/productCardBrandLogo.css"), "utf8");

describe("mobile catalogue product-card layout", () => {
  it("uses a readable one-column list and preserves a compact related-products variant", () => {
    expect(styles).toContain("@media (max-width: 640px)");
    expect(styles).toContain("grid-template-columns: 1fr !important;");
    expect(styles).toContain("grid-template-columns: 124px minmax(0, 1fr) !important;");
    expect(styles).toContain(".product-card:not(.product-card-compact)");
    expect(styles).toContain(".product-card-compact .product-card-brand-logo");
  });

  it("keeps prices, logo marks and cart controls touch-readable in the mobile list", () => {
    expect(styles).toContain("max-height: 31px !important;");
    expect(styles).toContain("font-size: 1.1rem !important;");
    expect(styles).toContain("height: 38px !important;");
  });
});
