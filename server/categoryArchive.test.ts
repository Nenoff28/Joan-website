import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  catalogueCategories,
  catalogueProductCategoryLinks,
  catalogueProducts,
} from "../drizzle/schema";
import {
  buildProductCategoryOptions,
  validateSelectedSubcategoryPath,
  type ProductCategoryTreeRow,
} from "./productCategoryAssignments";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

import {
  saveAdminCategory,
  setAdminCategoryArchived,
} from "./catalogueService";

type CategoryState = {
  id: number;
  legacyCategoryId: number | null;
  legacyParentCategoryId: number | null;
  parentId: number | null;
  slug: string;
  name: string;
  description?: string;
  imageUrl?: string;
  icon?: string;
  subcategoriesJson: string;
  sortOrder: number;
  isActive: boolean;
  isArchived: boolean;
};

type ProductState = {
  id: number;
  categoryId: number;
  isActive: boolean;
  isArchived: boolean;
  name?: string;
};
type LinkState = { id: number; productId: number; categoryId: number };
type AuditState = {
  adminUserId: number;
  action: string;
  entityType: string;
  entityId: number | null;
  metadataJson: string;
};

type Fixture = ReturnType<typeof categoryDb>;

function category(
  id: number,
  overrides: Partial<CategoryState> = {}
): CategoryState {
  return {
    id,
    legacyCategoryId: null,
    legacyParentCategoryId: null,
    parentId: null,
    slug: `category-${id}`,
    name: `Категория ${id}`,
    description: "",
    imageUrl: "/category.png",
    icon: "folder",
    subcategoriesJson: "[]",
    sortOrder: id,
    isActive: true,
    isArchived: false,
    ...overrides,
  };
}

function categoryDb(
  initialCategories: CategoryState[],
  initialProducts: ProductState[] = [],
  initialLinks: LinkState[] = []
) {
  let categories = initialCategories.map(row => ({ ...row }));
  let products = initialProducts.map(row => ({ ...row }));
  let links = initialLinks.map(row => ({ ...row }));
  const audits: AuditState[] = [];
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> =
    [];
  let deletes = 0;

  const rowsFor = (table: unknown) => {
    if (table === catalogueCategories) return categories;
    if (table === catalogueProducts)
      return products.filter(row =>
        categories.some(category => category.id === row.categoryId)
      );
    if (table === catalogueProductCategoryLinks)
      return links.filter(row =>
        categories.some(category => category.id === row.categoryId)
      );
    return [];
  };

  const makeQuery = (table: unknown) => {
    const query: any = {
      from: vi.fn((selectedTable: unknown) => {
        table = selectedTable;
        return query;
      }),
      where: vi.fn(() => query),
      limit: vi.fn(() => query),
      orderBy: vi.fn(() => query),
      for: vi.fn(async () => rowsFor(table).map(row => ({ ...row }))),
      then: (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown
      ) =>
        Promise.resolve(rowsFor(table).map(row => ({ ...row }))).then(
          resolve,
          reject
        ),
    };
    return query;
  };

  const tx = {
    select: vi.fn(() => makeQuery(undefined)),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(async () => {
          updates.push({ table, values });
          if (table === catalogueCategories)
            categories = categories.map(row =>
              row.id === initialCategories[0]?.id ||
              row.id ===
                initialCategories.find(
                  candidate => candidate.isArchived !== values.isArchived
                )?.id
                ? { ...row, ...values }
                : row
            );
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        deletes += 1;
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (values: AuditState) => {
        if (
          table === undefined ||
          table === catalogueCategories ||
          table === catalogueProducts ||
          table === catalogueProductCategoryLinks
        )
          return;
        audits.push(values);
      }),
    })),
  };

  // The service's category update is always for the requested row. Keep this
  // small fixture deterministic without attempting to interpret Drizzle SQL ASTs.
  tx.update = vi.fn((table: unknown) => ({
    set: vi.fn((values: Record<string, unknown>) => ({
      where: vi.fn(async () => {
        updates.push({ table, values });
        if (table === catalogueCategories) {
          const target =
            categories.find(
              row =>
                row.id ===
                initialCategories.find(
                  candidate => candidate.isArchived !== values.isArchived
                )?.id
            ) ?? categories[0];
          if (target)
            categories = categories.map(row =>
              row.id === target.id ? { ...row, ...values } : row
            );
        }
      }),
    })),
  }));

  const db = {
    transaction: vi.fn(
      async <T>(callback: (transaction: typeof tx) => Promise<T>) => {
        const beforeCategories = categories.map(row => ({ ...row }));
        const beforeProducts = products.map(row => ({ ...row }));
        const beforeLinks = links.map(row => ({ ...row }));
        const beforeAudits = audits.slice();
        try {
          return await callback(tx);
        } catch (error) {
          categories = beforeCategories;
          products = beforeProducts;
          links = beforeLinks;
          audits.splice(0, audits.length, ...beforeAudits);
          throw error;
        }
      }
    ),
  };

  return {
    db,
    tx,
    audits,
    updates,
    getCategories: () => categories,
    getProducts: () => products,
    getLinks: () => links,
    getDeletes: () => deletes,
  };
}

const actorId = 17;

describe("category soft archive backend workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives an empty category without deleting or changing product rows", async () => {
    const fixture = categoryDb(
      [category(10)],
      [
        {
          id: 90,
          categoryId: 99,
          isActive: true,
          isArchived: false,
          name: "Продукт",
        },
      ]
    );
    getDbMock.mockResolvedValue(fixture.db);

    await expect(setAdminCategoryArchived(10, true, actorId)).resolves.toEqual({
      id: 10,
      isArchived: true,
      isActive: false,
    });
    expect(fixture.getCategories()[0]).toMatchObject({
      id: 10,
      isArchived: true,
      isActive: false,
    });
    expect(fixture.getProducts()).toEqual([
      {
        id: 90,
        categoryId: 99,
        isActive: true,
        isArchived: false,
        name: "Продукт",
      },
    ]);
    expect(fixture.getDeletes()).toBe(0);
    expect(fixture.audits).toHaveLength(1);
    expect(fixture.audits[0]).toMatchObject({
      adminUserId: actorId,
      action: "category.archived",
      entityType: "category",
      entityId: 10,
    });
  });

  it("blocks non-archived native and legacy children in the collapsed hierarchy", async () => {
    const fixture = categoryDb([
      category(4, { slug: "banya", name: "Баня" }),
      category(11, { parentId: 4, slug: "native-child", name: "Native дете" }),
      category(12, {
        legacyCategoryId: 96,
        legacyParentCategoryId: 95,
        parentId: null,
        isActive: false,
        slug: "legacy-child",
        name: "Legacy дете",
      }),
    ]);
    getDbMock.mockResolvedValue(fixture.db);

    await expect(setAdminCategoryArchived(4, true, actorId)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("непремахнати подкатегории"),
    });
    expect(fixture.getCategories().every(row => !row.isArchived)).toBe(true);
    expect(fixture.audits).toHaveLength(0);
  });

  it("blocks products and category links even when legacy records are inactive or archived", async () => {
    const productFixture = categoryDb(
      [category(10)],
      [{ id: 1, categoryId: 10, isActive: false, isArchived: true }]
    );
    getDbMock.mockResolvedValue(productFixture.db);
    await expect(setAdminCategoryArchived(10, true, actorId)).rejects.toThrow(
      "свързани продукти"
    );

    const linkFixture = categoryDb(
      [category(10)],
      [],
      [{ id: 1, productId: 9, categoryId: 10 }]
    );
    getDbMock.mockResolvedValue(linkFixture.db);
    await expect(setAdminCategoryArchived(10, true, actorId)).rejects.toThrow(
      "свързани продуктови връзки"
    );
  });

  it("is idempotent and does not add a duplicate archive audit", async () => {
    const fixture = categoryDb([
      category(10, { isActive: false, isArchived: true }),
    ]);
    getDbMock.mockResolvedValue(fixture.db);

    await expect(setAdminCategoryArchived(10, true, actorId)).resolves.toEqual({
      id: 10,
      isArchived: true,
      isActive: false,
    });
    expect(fixture.audits).toHaveLength(0);
  });

  it("does not hide an active category when a restore request is repeated", async () => {
    const fixture = categoryDb([category(10)]);
    getDbMock.mockResolvedValue(fixture.db);
    await expect(setAdminCategoryArchived(10, false, actorId)).resolves.toEqual(
      { id: 10, isArchived: false, isActive: true }
    );
    expect(fixture.getCategories()).toEqual([category(10)]);
    expect(fixture.updates).toHaveLength(0);
    expect(fixture.audits).toHaveLength(0);
  });

  it("restores a native category as hidden without deleting its image or URL", async () => {
    const fixture = categoryDb([
      category(10, { isActive: false, isArchived: true }),
    ]);
    getDbMock.mockResolvedValue(fixture.db);
    await expect(setAdminCategoryArchived(10, false, actorId)).resolves.toEqual(
      { id: 10, isArchived: false, isActive: false }
    );
    expect(fixture.getCategories()[0]).toMatchObject({
      slug: "category-10",
      imageUrl: "/category.png",
      isArchived: false,
      isActive: false,
    });
    expect(fixture.audits[0]).toMatchObject({
      action: "category.restored",
      adminUserId: actorId,
    });
    expect(fixture.getDeletes()).toBe(0);
  });

  it("reports a missing category without changing data", async () => {
    const fixture = categoryDb([category(10)]);
    getDbMock.mockResolvedValue(fixture.db);

    await expect(setAdminCategoryArchived(999, true, actorId)).rejects.toThrow(
      "Категорията не е намерена."
    );
    expect(fixture.getCategories()).toEqual([category(10)]);
    expect(fixture.audits).toHaveLength(0);
  });

  it("requires an existing non-archived parent when restoring a child", async () => {
    const fixture = categoryDb([
      category(1, { slug: "parent" }),
      category(2, { parentId: 1, isActive: false, isArchived: true }),
    ]);
    fixture.getCategories()[0].isArchived = true;
    getDbMock.mockResolvedValue(fixture.db);

    await expect(setAdminCategoryArchived(2, false, actorId)).rejects.toThrow(
      "родителят липсва или е архивиран"
    );
    expect(fixture.audits).toHaveLength(0);
  });

  it("rejects a stale save draft for an archived category", async () => {
    const fixture = categoryDb([
      category(10, { isActive: false, isArchived: true }),
    ]);
    getDbMock.mockResolvedValue(fixture.db);
    const payload = {
      slug: "category-10",
      name: "Категория 10",
      description: "",
      imageUrl: "/category.png",
      icon: "folder",
      sortOrder: 10,
      isActive: true,
      parentId: null,
    };

    await expect(saveAdminCategory(10, payload, actorId)).rejects.toThrow(
      "Архивирана категория"
    );
    expect(fixture.audits).toHaveLength(0);
  });

  it("excludes archived roots and imported rows from assignment options and path validation", () => {
    const roots = [
      {
        id: 1,
        slug: "banya",
        name: "Баня",
        legacyCategoryId: null,
        legacyParentCategoryId: null,
        parentId: null,
        sortOrder: 0,
        isActive: true,
        isArchived: false,
      },
      {
        id: 2,
        slug: "archived",
        name: "Архивиран корен",
        legacyCategoryId: null,
        legacyParentCategoryId: null,
        parentId: null,
        sortOrder: 1,
        isActive: true,
        isArchived: true,
      },
    ] satisfies ProductCategoryTreeRow[];
    const taxonomy = [
      {
        id: 11,
        name: "Архивирано legacy дете",
        legacyCategoryId: 96,
        legacyParentCategoryId: 95,
        parentId: null,
        sortOrder: 0,
        isActive: false,
        isArchived: true,
      },
      {
        id: 12,
        name: "Видимо legacy дете",
        legacyCategoryId: 97,
        legacyParentCategoryId: 95,
        parentId: null,
        sortOrder: 1,
        isActive: false,
        isArchived: false,
      },
    ] satisfies ProductCategoryTreeRow[];

    expect(buildProductCategoryOptions(roots, taxonomy)[0]?.children).toEqual([
      { id: 12, label: "Видимо legacy дете" },
    ]);
    expect(() =>
      validateSelectedSubcategoryPath(taxonomy, [95], [11], 1)
    ).toThrow("активни");
  });

  it("allows an empty root whose stale JSON is empty and blocks JSON-only dependencies", async () => {
    const fixture = categoryDb([
      category(10, {
        subcategoriesJson: JSON.stringify([{ label: "Само JSON" }]),
      }),
    ]);
    getDbMock.mockResolvedValue(fixture.db);
    await expect(setAdminCategoryArchived(10, true, actorId)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("подкатегории, записани"),
    });
  });
});
