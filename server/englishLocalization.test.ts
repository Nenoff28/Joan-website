import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const languageSource = readFileSync(resolve(root, "client/src/contexts/LanguageContext.tsx"), "utf8");
const storefrontSource = readFileSync(resolve(root, "client/src/components/Storefront.tsx"), "utf8");
const homeSource = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
const categorySource = readFileSync(resolve(root, "client/src/pages/Category.tsx"), "utf8");
const productSource = readFileSync(resolve(root, "client/src/pages/Product.tsx"), "utf8");
const supportSources = ["About", "Contact", "Delivery", "FAQ", "Returns", "Terms"].map((name) => readFileSync(resolve(root, `client/src/pages/${name}.tsx`), "utf8")).join("\n");

describe("public English localization", () => {
  it("keeps the shared dictionary and storefront navigation bilingual", () => {
    expect(languageSource).toContain('language: "Language"');
    expect(storefrontSource).toContain('"Primary navigation"');
    expect(storefrontSource).toContain('"Frequently asked questions"');
    expect(storefrontSource).toContain('"In stock"');
  });

  it("localizes homepage shelves and public support pages without translating imported product records", () => {
    expect(homeSource).toContain('"Building materials"');
    expect(homeSource).toContain('"Current offers"');
    expect(homeSource).toContain('"Best sellers"');
    expect(supportSources).toContain('"Terms of use"');
    expect(supportSources).toContain('"Product returns"');
    expect(supportSources).toContain('"Frequently asked questions"');
  });

  it("localizes core catalogue controls and pagination", () => {
    expect(categorySource).toContain('"Search manufacturer"');
    expect(categorySource).toContain('"Price: low to high"');
    expect(categorySource).toContain('"Product pages"');
    expect(categorySource).toContain('"No products for the selected filter."');
  });

  it("localizes fixed Product gallery, quantity and fallback interface copy", () => {
    expect(productSource).toContain('"Zoom product image"');
    expect(productSource).toContain('"Product gallery"');
    expect(productSource).toContain('"Decrease quantity"');
    expect(productSource).toContain('"Product not found."');
    expect(productSource).toContain('"Compare product"');
  });
});
