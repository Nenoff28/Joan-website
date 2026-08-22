import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { categoryTreeFor, publicCategoryHierarchy } from "../client/src/lib/categoryHierarchy";

const headerSource = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
const categorySource = readFileSync(resolve(process.cwd(), "client/src/pages/Category.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const catalogueStyles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

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
    expect(categorySource).toContain("function CategoryHierarchy");
    expect(categorySource).toContain("category-hierarchy-browser");
    expect(categorySource).toContain("category-hierarchy-leaves");
    expect(categorySource).toContain("category-hero-path");
  });

  it("replaces the expanded browser with concise path context after a subcategory is selected", () => {
    expect(categorySource).toContain("{!selectedPathLabel && <CategoryHierarchy");
    expect(categorySource).toContain("category-hero-path");
    expect(categorySource).toContain("Каталог Жоан");
  });

  it("removes the redundant listing heading only for selected subcategory paths", () => {
    expect(categorySource).toContain('selectedPathLabel ? "is-selected-subcategory" : ""');
    expect(categorySource).toContain('{!selectedPathLabel && <div className="listing-heading">');
    expect(categorySource).toContain("selected-path-filter");
  });

  it("removes the redundant category quick-links panel from catalogue product results", () => {
    expect(categorySource).not.toContain("CategoryQuickLinks");
    expect(categorySource).toContain('className="catalogue-workbench"');
  });

  it("keeps the manufacturer chooser collapsed by default and searchable", () => {
    expect(categorySource).toContain("const [manufacturerQuery, setManufacturerQuery]");
    expect(categorySource).toContain('<details className="manufacturer-filter">');
    expect(categorySource).toContain("Производител");
    expect(categorySource).toContain('placeholder="Търсене на производител"');
  });

  it("suppresses the ITEM and CAT-FILTER implementation markers in public catalogue views", () => {
    expect(catalogueStyles).toContain(".category-content-row::before, .catalogue-workbench .product-card::before { content: none; }");
  });

  it("uses exact imported category trees instead of stale static labels when legacy metadata is available", () => {
    const importedTree = [{ label: "Точна група", children: [{ label: "Точен подтип" }] }];
    expect(categoryTreeFor("instrumenti", importedTree)).toEqual(importedTree);
  });

  it("provides a complete catalogue route instead of mapping all products to Tools", () => {
    expect(appSource).toContain('path={"/products"} component={AllProducts}');
    expect(categorySource).toContain("export function AllProducts() { return <CataloguePage showAll />; }");
    expect(categorySource).toContain("const cataloguePage = useCataloguePage(catalogueInput)");
    expect(categorySource).toContain("categorySlug: showAll ? undefined : category?.slug");
    expect(categorySource).toContain("const catalogueInput = useMemo(() =>");
    expect(categorySource).toContain("const navigateToCatalogue = (href: string)");
    expect(headerSource).toContain('href="/products"');
    expect(homeSource).toContain('href="/products">Всички продукти');
    expect(headerSource).toContain('location === "/products" || location.startsWith("/category")');
  });
});
