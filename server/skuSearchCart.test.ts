import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const catalogue = readFileSync(resolve(root, "server/catalogueService.ts"), "utf8");
const checkout = readFileSync(resolve(root, "client/src/pages/Checkout.tsx"), "utf8");
const storefront = readFileSync(resolve(root, "client/src/components/Storefront.tsx"), "utf8");

describe("canonical internal code across search and cart", () => {
  it("searches the public catalogue by the current SKU", () => {
    expect(catalogue).toContain("like(catalogueProducts.sku, needle)");
  });

  it("opens filtered catalogue results when Enter is pressed in the header search", () => {
    expect(storefront).toContain("setLocation(`/products?query=${encodeURIComponent(term)}`)");
    expect(storefront).not.toContain('toast(t("noMatches"))');
    expect(readFileSync(resolve(root, "client/src/pages/Category.tsx"), "utf8")).toContain("const urlQuery = useMemo");
  });

  it("shows the current SKU in the full cart and preserves it for confirmation", () => {
    expect(checkout).toContain("row.product.sku?.trim()");
    expect(checkout).toContain("setSubmittedItems(checkoutRows.map");
    expect(checkout).toContain('className="checkout-confirmation-items"');
  });

  it("shows the current SKU in the header mini-cart", () => {
    expect(storefront).toContain('className="mini-cart-product-code"');
    expect(storefront).toContain("product.sku?.trim()");
  });
});
