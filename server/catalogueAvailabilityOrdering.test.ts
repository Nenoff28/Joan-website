import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const catalogueService = readFileSync(resolve(process.cwd(), "server/catalogueService.ts"), "utf8");

describe("public catalogue availability ordering", () => {
  it("places only confirmed out-of-stock products after all other availability states", () => {
    expect(catalogueService).toContain("CASE WHEN ${catalogueProducts.availability} = 'out_of_stock' THEN 1 ELSE 0 END");
  });

  it("applies the out-of-stock priority before relevance, price, and name sorting", () => {
    expect(catalogueService).toContain('const name = language === "en" ? sql<string>`COALESCE(${catalogueProductEnglish.name}, ${catalogueProducts.name})` : catalogueProducts.name;');
    expect(catalogueService).toContain('return [outOfStockLast, asc(catalogueProducts.priceEur), asc(name)]');
    expect(catalogueService).toContain('return [outOfStockLast, desc(catalogueProducts.priceEur), asc(name)]');
    expect(catalogueService).toContain('return [outOfStockLast, asc(name)]');
    expect(catalogueService).toContain('return [outOfStockLast, desc(name)]');
    expect(catalogueService).toContain('return [outOfStockLast, desc(catalogueProducts.updatedAt), asc(name)]');
  });
});
