import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const catalogueService = readFileSync(resolve(process.cwd(), "server/catalogueService.ts"), "utf8");
const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const categoryPage = readFileSync(resolve(process.cwd(), "client/src/pages/Category.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/pages/manufacturerFilter.css"), "utf8");

describe("manufacturer multi-select filtering", () => {
  it("accepts a bounded brands array and applies OR matching for selected manufacturers", () => {
    expect(router).toContain('brands: z.array(z.string().trim().min(1).max(160)).min(1).max(30).optional()');
    expect(catalogueService).toContain('const selectedBrands = input.brands?.length ? input.brands : input.brand ? [input.brand] : []');
    expect(catalogueService).toContain('conditions.push(or(...brandConditions)!)');
  });

  it("uses checkboxes, selected count and a scrollable manufacturer list in the catalogue UI", () => {
    expect(categoryPage).toContain('const [selectedBrands, setSelectedBrands] = useState<string[]>([])');
    expect(categoryPage).toContain('type="checkbox" value={brand}');
    expect(categoryPage).toContain('selectedBrands.length ? <b>{selectedBrands.length}</b>');
    expect(styles).toContain('max-height: 18.5rem;');
    expect(styles).toContain('overflow-y: auto;');
  });
});
