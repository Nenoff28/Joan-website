import { describe, expect, it } from "vitest";
import {
  buildProductCategoryOptions,
  canonicalSelectedSubcategoryPath,
  categoryPathNodes,
  validateSelectedSubcategoryPath,
  type ProductCategoryTreeRow,
} from "./productCategoryAssignments";

const roots = [
  { id: 4, legacyCategoryId: null, legacyParentCategoryId: null, slug: "banya", name: "Баня", sortOrder: 3, isActive: true },
  { id: 10, legacyCategoryId: null, legacyParentCategoryId: null, slug: "stroitelstvo", name: "Строителство", sortOrder: 9, isActive: true },
  { id: 99, legacyCategoryId: null, legacyParentCategoryId: null, slug: "inactive-root", name: "Скрит корен", sortOrder: 0, isActive: false },
] satisfies ProductCategoryTreeRow[];

const taxonomy = [
  { id: 60032, legacyCategoryId: 99, legacyParentCategoryId: 95, name: "Плочки", sortOrder: 0, isActive: false },
  { id: 60033, legacyCategoryId: 100, legacyParentCategoryId: 99, name: "Гранитогрес", sortOrder: 0, isActive: false },
  { id: 60096, legacyCategoryId: 167, legacyParentCategoryId: 178, name: "Покриви", sortOrder: 0, isActive: false },
  { id: 60200, legacyCategoryId: 200, legacyParentCategoryId: 167, name: "Керемиди", sortOrder: 1, isActive: false },
] satisfies ProductCategoryTreeRow[];

describe("product category assignment helpers", () => {
  it("returns active public roots only while retaining inactive imported taxonomy children", () => {
    const options = buildProductCategoryOptions(roots, taxonomy);
    expect(options.map((option) => option.id)).toEqual([4, 10]);
    expect(options[0].children).toEqual([{ id: 60032, label: "Плочки", children: [{ id: 60033, label: "Гранитогрес" }] }]);
    expect(options[1].children).toEqual([{ id: 60096, label: "Покриви", children: [{ id: 60200, label: "Керемиди" }] }]);
  });

  it("accepts inactive taxonomy rows but rejects a non-contiguous or wrong-root path", () => {
    expect(validateSelectedSubcategoryPath(taxonomy, [95], [60032, 60033]).map((row) => row.id)).toEqual([60032, 60033]);
    expect(() => validateSelectedSubcategoryPath(taxonomy, [95], [60033])).toThrow("непрекъснат път");
    expect(() => validateSelectedSubcategoryPath(taxonomy, [178], [60032])).toThrow("непрекъснат път");
  });

  it("chooses the longest valid linked branch deterministically and exposes path nodes", () => {
    const links = [
      { categoryId: 60032, position: 2 },
      { categoryId: 60033, position: 3 },
      { categoryId: 60107, position: 1 },
      { categoryId: 60200, position: 4 },
    ];
    const path = canonicalSelectedSubcategoryPath(taxonomy, [95], links);
    expect(path.map((row) => row.id)).toEqual([60032, 60033]);
    expect(categoryPathNodes(path)).toEqual([{ id: 60032, label: "Плочки" }, { id: 60033, label: "Гранитогрес" }]);
  });

  it("uses link position and then category id as stable tie breakers for equal branches", () => {
    const rows = [
      { id: 11, legacyCategoryId: 11, legacyParentCategoryId: 1, name: "A", sortOrder: 0 },
      { id: 12, legacyCategoryId: 12, legacyParentCategoryId: 1, name: "B", sortOrder: 0 },
    ] satisfies ProductCategoryTreeRow[];
    expect(canonicalSelectedSubcategoryPath(rows, [1], [{ categoryId: 12, position: 3 }, { categoryId: 11, position: 1 }]).map((row) => row.id)).toEqual([11]);
  });
});
