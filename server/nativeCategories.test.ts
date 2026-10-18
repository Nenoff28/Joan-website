import { describe, expect, it } from "vitest";
import {
  buildProductCategoryOptions,
  canonicalSelectedSubcategoryPath,
  categoryPathNodes,
  validateSelectedSubcategoryPath,
  type ProductCategoryTreeRow,
} from "./productCategoryAssignments";
import { categoryPayloadSchema } from "../shared/categoryValidation";

const rootMap = { banya: [95], other: [99] };

function nativeRow(
  id: number,
  name: string,
  parentId: number | null,
  isActive = true,
  sortOrder = id
): ProductCategoryTreeRow {
  return {
    id,
    legacyCategoryId: null,
    legacyParentCategoryId: null,
    parentId,
    name,
    sortOrder,
    slug: `native-${id}`,
    isActive,
  };
}

function importedRow(
  id: number,
  legacyCategoryId: number,
  legacyParentCategoryId: number,
  name: string,
  isActive = false,
  sortOrder = id
): ProductCategoryTreeRow {
  return {
    id,
    legacyCategoryId,
    legacyParentCategoryId,
    parentId: null,
    name,
    sortOrder,
    slug: `imported-${id}`,
    isActive,
  };
}

const banyaRoot: ProductCategoryTreeRow = {
  id: 1,
  legacyCategoryId: null,
  legacyParentCategoryId: null,
  parentId: null,
  name: "Баня",
  sortOrder: 0,
  slug: "banya",
  isActive: true,
};

const otherRoot: ProductCategoryTreeRow = {
  id: 2,
  legacyCategoryId: null,
  legacyParentCategoryId: null,
  parentId: null,
  name: "Друг корен",
  sortOrder: 1,
  slug: "other",
  isActive: true,
};

describe("native and imported category assignment behavior", () => {
  it("builds and validates a main native root -> child -> grandchild path", () => {
    const child = nativeRow(10, "Смесители", 1);
    const grandchild = nativeRow(11, "Смесители за баня", 10);
    const taxonomy = [child, grandchild];

    expect(
      buildProductCategoryOptions([banyaRoot], taxonomy, rootMap, 1)
    ).toEqual([
      {
        id: 1,
        label: "Баня",
        slug: "banya",
        children: [
          {
            id: 10,
            label: "Смесители",
            children: [{ id: 11, label: "Смесители за баня" }],
          },
        ],
      },
    ]);
    expect(
      validateSelectedSubcategoryPath(taxonomy, [], [10, 11], 1).map(
        row => row.id
      )
    ).toEqual([10, 11]);
    expect(
      canonicalSelectedSubcategoryPath(
        taxonomy,
        [],
        [
          { categoryId: 10, position: 0 },
          { categoryId: 11, position: 1 },
        ],
        1
      ).map(row => row.id)
    ).toEqual([10, 11]);
  });

  it("keeps an active root as a root-only option when it has no children", () => {
    expect(buildProductCategoryOptions([banyaRoot], [], rootMap, 1)).toEqual([
      { id: 1, label: "Баня", slug: "banya" },
    ]);
    expect(validateSelectedSubcategoryPath([], [], undefined, 1)).toEqual([]);
    expect(canonicalSelectedSubcategoryPath([], [], [], 1)).toEqual([]);
  });

  it("excludes an inactive native branch, including its otherwise active descendants", () => {
    const inactiveChild = nativeRow(20, "Скрита native група", 1, false);
    const activeGrandchild = nativeRow(21, "Скрито native дете", 20, true);

    expect(
      buildProductCategoryOptions(
        [banyaRoot],
        [inactiveChild, activeGrandchild],
        rootMap,
        1
      )
    ).toEqual([{ id: 1, label: "Баня", slug: "banya" }]);
    expect(() =>
      validateSelectedSubcategoryPath(
        [inactiveChild, activeGrandchild],
        [],
        [20],
        1
      )
    ).toThrow("трябва да са активни");
    expect(() =>
      validateSelectedSubcategoryPath(
        [inactiveChild, activeGrandchild],
        [],
        [21],
        1
      )
    ).toThrow("непрекъснат път");
  });

  it("retains inactive imported rows and accepts their contiguous path", () => {
    const importedChild = importedRow(30, 96, 95, "Плочки");
    const importedGrandchild = importedRow(31, 97, 96, "Гранитогрес");
    const taxonomy = [importedChild, importedGrandchild];

    expect(
      buildProductCategoryOptions([banyaRoot], taxonomy, rootMap, 1)[0]
        ?.children
    ).toEqual([
      { id: 30, label: "Плочки", children: [{ id: 31, label: "Гранитогрес" }] },
    ]);
    expect(
      validateSelectedSubcategoryPath(taxonomy, [95], [30, 31], 1).map(
        row => row.id
      )
    ).toEqual([30, 31]);
    expect(
      canonicalSelectedSubcategoryPath(
        taxonomy,
        [95],
        [{ categoryId: 30 }, { categoryId: 31 }],
        1
      ).map(row => row.id)
    ).toEqual([30, 31]);
  });

  it("supports an imported -> native branch while retaining the imported path anchor", () => {
    const importedChild = importedRow(40, 96, 95, "Импортен клон");
    const nativeChild = nativeRow(41, "Native дете", 40);
    const nativeGrandchild = nativeRow(42, "Native внуче", 41);
    const taxonomy = [importedChild, nativeChild, nativeGrandchild];

    expect(
      buildProductCategoryOptions([banyaRoot], taxonomy, rootMap, 1)[0]
        ?.children
    ).toEqual([
      {
        id: 40,
        label: "Импортен клон",
        children: [
          {
            id: 41,
            label: "Native дете",
            children: [{ id: 42, label: "Native внуче" }],
          },
        ],
      },
    ]);
    const selected = validateSelectedSubcategoryPath(
      taxonomy,
      [95],
      [40, 41, 42],
      1
    );
    const canonical = canonicalSelectedSubcategoryPath(
      taxonomy,
      [95],
      selected.map((row, position) => ({ categoryId: row.id, position })),
      1
    );
    expect(categoryPathNodes(canonical)).toEqual([
      { id: 40, label: "Импортен клон" },
      { id: 41, label: "Native дете" },
      { id: 42, label: "Native внуче" },
    ]);
  });

  it("rejects a path whose first child belongs to another public root", () => {
    const wrongImportedRoot = importedRow(50, 100, 99, "Чужда импортна група");
    const wrongNativeChild = nativeRow(51, "Чуждо native дете", 2);

    expect(() =>
      validateSelectedSubcategoryPath([wrongImportedRoot], [95], [50], 1)
    ).toThrow("непрекъснат път");
    expect(() =>
      validateSelectedSubcategoryPath([wrongNativeChild], [95], [51], 1)
    ).toThrow("непрекъснат път");
  });

  it("rejects repeated selections and paths longer than four levels", () => {
    const child = nativeRow(60, "Ниво 1", 1);
    expect(() =>
      validateSelectedSubcategoryPath([child], [], [60, 60], 1)
    ).toThrow("не могат да се повтарят");
    expect(() =>
      validateSelectedSubcategoryPath([], [], [1, 2, 3, 4, 5], 1)
    ).toThrow("най-много четири");
  });

  it("round-trips a canonical native path into stable path nodes", () => {
    const rows = [
      nativeRow(70, "Ниво 1", 1),
      nativeRow(71, "Ниво 2", 70),
      nativeRow(72, "Ниво 3", 71),
    ];
    const selected = validateSelectedSubcategoryPath(rows, [], [70, 71, 72], 1);
    const canonical = canonicalSelectedSubcategoryPath(
      rows,
      [],
      selected.map((row, position) => ({ categoryId: row.id, position })),
      1
    );
    expect(categoryPathNodes(canonical)).toEqual(categoryPathNodes(selected));
  });
});

describe("shared category payload contract", () => {
  const base = {
    slug: "valid-category",
    name: "Категория",
    description: "",
    imageUrl: "/manus-storage/category.png",
    icon: "house",
    sortOrder: 0,
    isActive: true,
  };

  it("accepts Latin slugs and rejects Cyrillic or uppercase URL slugs", () => {
    expect(categoryPayloadSchema.safeParse(base).success).toBe(true);
    expect(
      categoryPayloadSchema.safeParse({ ...base, slug: "Категория" }).success
    ).toBe(false);
    expect(
      categoryPayloadSchema.safeParse({ ...base, slug: "Valid-category" })
        .success
    ).toBe(false);
  });

  it("requires an image for roots but allows an image-less child with a positive parent", () => {
    expect(
      categoryPayloadSchema.safeParse({ ...base, imageUrl: "", parentId: null })
        .success
    ).toBe(false);
    expect(
      categoryPayloadSchema.safeParse({
        ...base,
        imageUrl: "",
        parentId: 42,
        name: "Подкатегория",
      }).success
    ).toBe(true);
    expect(
      categoryPayloadSchema.safeParse({
        ...base,
        imageUrl: "",
        parentId: 0,
        name: "Подкатегория",
      }).success
    ).toBe(false);
  });
});
