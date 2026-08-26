import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const storefront = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/components/productCardBrandLogo.css"), "utf8");

describe("catalogue logo refinements", () => {
  it("uses the official Joan logo when a product has the storefront Joan fallback brand", () => {
    expect(storefront).toContain('const joanLogoUrl = "/manus-storage/joan-existing-logo_61725b9d.webp"');
    expect(storefront).toContain('product.brandLogo ?? (productBrand === "ЖОАН" ? joanLogoUrl : undefined)');
  });

  it("keeps targeted contrast and larger sizing scoped to the requested catalogue brands", () => {
    expect(storefront).toContain('"Cerva", "Elite"');
    expect(storefront).toContain('"Makena"');
    expect(storefront).toContain('"York"');
    expect(storefront).toContain('"Dupli-Color"');
    expect(storefront).toContain('"Генковски"');
    expect(styles).toContain('.product-card.has-refined-catalogue-logo .product-card-brand-logo');
    expect(styles).toContain('max-height: 38px;');
  });
});
