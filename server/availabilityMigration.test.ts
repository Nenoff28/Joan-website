import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const importerSource = readFileSync(resolve(process.cwd(), "scripts/import-opencart-approved-data.mjs"), "utf8");
const reconcilerSource = readFileSync(resolve(process.cwd(), "scripts/reconcile-opencart-availability.mjs"), "utf8");
const productCardSource = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
const productPageSource = readFileSync(resolve(process.cwd(), "client/src/pages/Product.tsx"), "utf8");
const serviceSource = readFileSync(resolve(process.cwd(), "server/catalogueService.ts"), "utf8");

describe("OpenCart availability migration safeguards", () => {
  it("keeps explicit legacy 'Не е наличен' statuses out of stock instead of treating them as on-request", () => {
    expect(importerSource).toContain('legacyStockStatus.includes("не е наличен") || legacyStockStatus.includes("изчерпан")');
    expect(importerSource).toContain('return "out_of_stock";');
    expect(reconcilerSource).toContain('status.includes("не е наличен") || status.includes("изчерпан")');
  });

  it("uses the source stock status for on-request and in-stock exceptions at zero quantity", () => {
    expect(importerSource).toContain('legacyStockStatus.includes("по заявка") || legacyStockStatus.includes("2-3 дена")');
    expect(importerSource).toContain('legacyStockStatus.includes("на склад")');
  });

  it("prevents out-of-stock products from being offered for direct cart addition or checkout requests", () => {
    expect(productCardSource).toContain('const isOutOfStock = product.availabilityCode === "out_of_stock";');
    expect(productCardSource).toContain('product.price && !isOutOfStock');
    expect(productPageSource).toContain('const isOutOfStock = product?.availabilityCode === "out_of_stock";');
    expect(serviceSource).toContain('ne(catalogueProducts.availability, "out_of_stock")');
  });
});
