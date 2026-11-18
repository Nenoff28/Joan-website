import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const storefront = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
const productPage = readFileSync(resolve(process.cwd(), "client/src/pages/Product.tsx"), "utf8");

// House-brand (ЖОАН) products have no manufacturer record; cards fall back to the JOAN logo,
// so the product page must use the same fallback instead of showing plain text.
describe("product brand logo fallback", () => {
  it("shares one JOAN-logo fallback between product cards and the product page", () => {
    expect(storefront).toContain("export function brandLogoFor(");
    expect(storefront).toContain("const brandLogo = brandLogoFor(product);");
    expect(productPage).toContain("const brandLogo = brandLogoFor(product);");
    expect(productPage).not.toContain("product.brandLogo && failedBrandLogo !== product.brandLogo");
  });
});
