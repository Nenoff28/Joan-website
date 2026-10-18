import { describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

import { getAdminCategories } from "./catalogueService";

const rows = [
  {
    id: 4,
    legacyCategoryId: null,
    legacyParentCategoryId: null,
    parentId: null,
    slug: "banya",
    name: "Баня",
    description: "Публичен корен",
    imageUrl: "/manus-storage/banya.png",
    icon: "house",
    subcategoriesJson: "[]",
    legacySeoKeywordBg: null,
    legacySeoKeywordEn: null,
    legacyMetaTitleBg: null,
    legacyMetaDescriptionBg: null,
    legacyMetaRobots: "index,follow",
    legacyCanonicalUrl: null,
    sortOrder: 0,
    isActive: true,
  },
  {
    id: 100,
    legacyCategoryId: 95,
    legacyParentCategoryId: null,
    parentId: null,
    slug: "legacy-banya-root",
    name: "Legacy source root",
    description: "Импортиран източник",
    imageUrl: "",
    icon: "folder",
    subcategoriesJson: "[]",
    legacySeoKeywordBg: null,
    legacySeoKeywordEn: null,
    legacyMetaTitleBg: null,
    legacyMetaDescriptionBg: null,
    legacyMetaRobots: "index,follow",
    legacyCanonicalUrl: null,
    sortOrder: 1,
    isActive: false,
  },
  {
    id: 101,
    legacyCategoryId: 96,
    legacyParentCategoryId: 95,
    parentId: null,
    slug: "legacy-tiles",
    name: "Плочки",
    description: "Импортирана първа група",
    imageUrl: "",
    icon: "folder",
    subcategoriesJson: "[]",
    legacySeoKeywordBg: null,
    legacySeoKeywordEn: null,
    legacyMetaTitleBg: null,
    legacyMetaDescriptionBg: null,
    legacyMetaRobots: "index,follow",
    legacyCanonicalUrl: null,
    sortOrder: 2,
    isActive: false,
  },
  {
    id: 102,
    legacyCategoryId: null,
    legacyParentCategoryId: null,
    parentId: 101,
    slug: "bathroom-tiles",
    name: "Гранитогрес",
    description: "Native дете на импортната група",
    imageUrl: "",
    icon: "folder",
    subcategoriesJson: "[]",
    legacySeoKeywordBg: null,
    legacySeoKeywordEn: null,
    legacyMetaTitleBg: null,
    legacyMetaDescriptionBg: null,
    legacyMetaRobots: "index,follow",
    legacyCanonicalUrl: null,
    sortOrder: 3,
    isActive: true,
  },
] as const;

function queryFor<T>(value: T) {
  const promise = Promise.resolve(value);
  const query: any = {
    then: promise.then.bind(promise),
    orderBy: () => promise,
  };
  query.from = () => query;
  return query;
}

describe("getAdminCategories native/imported hierarchy", () => {
  it("collapses the imported source root into public banya and carries metadata through a native grandchild", async () => {
    let selectCalls = 0;
    getDbMock.mockResolvedValue({
      select: vi.fn(() => {
        selectCalls += 1;
        return queryFor(selectCalls === 1 ? [{ total: rows.length }] : rows);
      }),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      })),
    });

    const categories = await getAdminCategories();
    const root = categories.find(category => category.id === 4);
    const importedChild = categories.find(category => category.id === 101);
    const nativeGrandchild = categories.find(category => category.id === 102);
    const importedSourceRoot = categories.find(category => category.id === 100);

    expect(root).toMatchObject({
      id: 4,
      parentId: null,
      rootId: 4,
      depth: 0,
      isMain: true,
      publicUrl: "/category/banya",
    });
    expect(importedSourceRoot).toMatchObject({
      parentId: null,
      rootId: null,
      depth: 0,
      isMain: false,
      publicUrl: null,
    });
    expect(importedChild).toMatchObject({
      parentId: 4,
      rootId: 4,
      depth: 1,
      isMain: false,
      publicUrl: "/category/banya?path=plochki",
    });
    expect(nativeGrandchild).toMatchObject({
      parentId: 101,
      rootId: 4,
      depth: 2,
      isMain: false,
      publicUrl: "/category/banya?path=plochki~granitogres",
    });
    expect(root?.subcategories).toEqual([
      { label: "Плочки", children: [{ label: "Гранитогрес" }] },
    ]);
    expect(selectCalls).toBe(3);
  });
});
