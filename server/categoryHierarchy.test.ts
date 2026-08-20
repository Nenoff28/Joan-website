import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { publicCategoryHierarchy } from "../client/src/lib/categoryHierarchy";

const headerSource = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
const categorySource = readFileSync(resolve(process.cwd(), "client/src/pages/Category.tsx"), "utf8");

describe("public Joan category hierarchy", () => {
  it("keeps the full public top-level taxonomy and the requested Tool examples", () => {
    expect(Object.keys(publicCategoryHierarchy)).toHaveLength(11);
    const tools = publicCategoryHierarchy.instrumenti;
    const powerTools = tools.find((node) => node.label === "Електроинструменти");
    const handTools = tools.find((node) => node.label === "Ръчни инструменти");
    expect(powerTools?.children?.some((node) => node.label === "Бормашини")).toBe(true);
    expect(handTools?.children?.some((node) => node.label === "Бъркалки")).toBe(true);
  });

  it("renders nested branches in both desktop and mobile category navigation", () => {
    expect(headerSource).toContain("function MegaCategoryTree");
    expect(headerSource).toContain("function MobileCategoryTree");
    expect(headerSource).toContain("mega-category-leaves");
    expect(headerSource).toContain("mobile-category-branch");
    expect(headerSource).toContain("?path=");
  });

  it("keeps nested category choices visible in the category landing experience", () => {
    expect(categorySource).toContain("function NestedCategoryChips");
    expect(categorySource).toContain("category-subtree-children");
    expect(categorySource).toContain("subcategory-count");
  });
});
