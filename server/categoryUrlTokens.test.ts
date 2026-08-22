import { describe, expect, it } from "vitest";
import { categoryLabelsFromTokens, categoryPathTokens, latinPathToken, publicCategoryHierarchy } from "../client/src/lib/categoryHierarchy";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const categorySource = readFileSync(resolve(process.cwd(), "client/src/pages/Category.tsx"), "utf8");
const navigationSource = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
const serviceSource = readFileSync(resolve(process.cwd(), "server/catalogueService.ts"), "utf8");

describe("Latin-only public category path tokens", () => {
  it("transliterates Bulgarian hierarchy labels into deterministic Latin URL tokens", () => {
    expect(latinPathToken("Електроуреди")).toBe("elektrouredi");
    expect(latinPathToken("Вакуум машини")).toBe("vakuum-mashini");
    expect(categoryPathTokens(["Електроуреди", "Вакуум машини"])).toEqual(["elektrouredi", "vakuum-mashini"]);
  });

  it("resolves a public token path back to the visible Bulgarian category labels", () => {
    expect(categoryLabelsFromTokens(publicCategoryHierarchy["za-doma"], ["elektrouredi", "vakuum-mashini"])).toEqual(["Електроуреди", "Вакуум машини"]);
  });

  it("builds and consumes selected subcategory routes with Latin tokens only", () => {
    expect(categorySource).toContain('categoryPathTokens(labels).join("~")');
    expect(navigationSource).toContain('categoryPathTokens(labels).join("~")');
    expect(serviceSource).toContain('latinPathToken(row.name) === label');
  });
});
