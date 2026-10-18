import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: getDbMock }));

import { setAdminProductArchived } from "./catalogueService";

type ProductState = {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  isArchived: boolean;
  isActive: boolean;
};

type AuditRow = {
  adminUserId: number;
  action: string;
  entityType: string;
  entityId: number;
  metadataJson: string;
};

function archiveDb(initial: ProductState) {
  let product = { ...initial };
  const audits: AuditRow[] = [];
  let failAudit = false;
  let selectForUpdateCalls = 0;

  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            for: vi.fn(async (lock: string) => {
              if (lock === "update") selectForUpdateCalls += 1;
              return product ? [{ ...product }] : [];
            }),
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Partial<ProductState>) => ({
        where: vi.fn(async () => {
          product = { ...product, ...values };
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: AuditRow) => {
        if (failAudit) throw new Error("simulated audit failure");
        audits.push(values);
      }),
    })),
  };

  const db = {
    transaction: vi.fn(async <T>(callback: (transaction: typeof tx) => Promise<T>) => {
      const beforeProduct = { ...product };
      const beforeAudits = audits.slice();
      try {
        return await callback(tx);
      } catch (error) {
        product = beforeProduct;
        audits.splice(0, audits.length, ...beforeAudits);
        throw error;
      }
    }),
  };

  return {
    db,
    tx,
    audits,
    getProduct: () => product,
    setFailAudit: (value: boolean) => { failAudit = value; },
    getSelectForUpdateCalls: () => selectForUpdateCalls,
  };
}

const originalProduct: ProductState = {
  id: 42,
  name: "Запазен продукт",
  slug: "zapazen-produkt",
  sku: "SKU-42",
  isArchived: false,
  isActive: true,
};

describe("catalogue product soft archive backend workflow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("archives a product without deleting it and records the actor and identity fields", async () => {
    const fixture = archiveDb(originalProduct);
    getDbMock.mockResolvedValue(fixture.db);

    await expect(setAdminProductArchived(42, true, 17)).resolves.toEqual({ id: 42, isArchived: true, isActive: false });
    expect(fixture.getProduct()).toEqual({ ...originalProduct, isArchived: true, isActive: false });
    expect(fixture.audits).toHaveLength(1);
    expect(fixture.audits[0]).toMatchObject({ adminUserId: 17, action: "product.archived", entityType: "product", entityId: 42 });
    expect(JSON.parse(fixture.audits[0].metadataJson)).toEqual({ name: originalProduct.name, slug: originalProduct.slug, sku: originalProduct.sku });
    expect(fixture.getSelectForUpdateCalls()).toBe(1);
  });

  it("restores an archived product as unpublished while preserving the product record", async () => {
    const fixture = archiveDb({ ...originalProduct, isArchived: true, isActive: false });
    getDbMock.mockResolvedValue(fixture.db);

    await expect(setAdminProductArchived(42, false, 17)).resolves.toEqual({ id: 42, isArchived: false, isActive: false });
    expect(fixture.getProduct()).toEqual({ ...originalProduct, isArchived: false, isActive: false });
    expect(fixture.audits).toHaveLength(1);
    expect(fixture.audits[0].action).toBe("product.restored");
  });

  it("is idempotent and does not create a second audit for the same state", async () => {
    const fixture = archiveDb({ ...originalProduct, isArchived: true, isActive: false });
    getDbMock.mockResolvedValue(fixture.db);

    await expect(setAdminProductArchived(42, true, 17)).resolves.toEqual({ id: 42, isArchived: true, isActive: false });
    expect(fixture.getProduct()).toEqual({ ...originalProduct, isArchived: true, isActive: false });
    expect(fixture.audits).toHaveLength(0);
  });

  it("rolls back the archive update when audit persistence fails", async () => {
    const fixture = archiveDb(originalProduct);
    fixture.setFailAudit(true);
    getDbMock.mockResolvedValue(fixture.db);

    await expect(setAdminProductArchived(42, true, 17)).rejects.toThrow("simulated audit failure");
    expect(fixture.getProduct()).toEqual(originalProduct);
    expect(fixture.audits).toHaveLength(0);
  });

  it("throws the Bulgarian not-found error without changing data or writing an audit", async () => {
    const fixture = archiveDb(originalProduct);
    fixture.tx.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({ for: vi.fn(async () => []) })),
        })),
      })),
    }));
    getDbMock.mockResolvedValue(fixture.db);

    await expect(setAdminProductArchived(999, true, 17)).rejects.toThrow("Продуктът не е намерен.");
    expect(fixture.getProduct()).toEqual(originalProduct);
    expect(fixture.audits).toHaveLength(0);
  });
});
