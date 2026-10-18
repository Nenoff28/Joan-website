import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { productPayloadSchema } from "../shared/productValidation";

const admin = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
const routers = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const valid = {
  categoryId: 4, subcategoryIds: [60032, 60035], slug: "test-product", name: "Тестов продукт", description: "Пълно описание на продукта",
  imageUrl: "/manus-storage/test.png", gallery: ["/manus-storage/test.png"], imageAlt: "Тестов продукт", availability: "in_stock" as const,
  stockQuantity: 1, features: [], isActive: true,
};

describe("product category editor and publish feedback", () => {
  it("accepts a bounded ordered subcategory path and remains compatible with old clients", () => {
    expect(productPayloadSchema.parse(valid).subcategoryIds).toEqual([60032, 60035]);
    const { subcategoryIds: _path, ...legacy } = valid;
    expect(productPayloadSchema.parse(legacy).subcategoryIds).toBeUndefined();
    expect(productPayloadSchema.safeParse({ ...valid, subcategoryIds: [60032, 60032] }).success).toBe(false);
    expect(productPayloadSchema.safeParse({ ...valid, subcategoryIds: [1, 2, 3, 4, 5] }).success).toBe(false);
  });
  it("loads the dedicated product tree and renders dependent dropdowns", () => {
    expect(routers).toContain("getAdminProductCategories()");
    expect(admin).toContain("subcategoryLevels.map");
    expect(admin).toContain('"Подкатегория"');
    expect(admin).toContain("subcategoryIds: []");
    expect(admin).toContain("current.subcategoryIds.slice(0, depth)");
  });
  it("preserves existing multi-category membership unless the category selection is edited", () => {
    expect(admin).toContain("!form.id || categorySelectionChanged");
    expect(admin).toContain("subcategoryIds: product.subcategoryIds ?? []");
  });
  it("shows a direct published link and distinguishes a draft from a published product", () => {
    expect(admin).toContain("Отвори в сайта");
    expect(admin).toContain("/product/${savedProduct.slug}");
    expect(admin).toContain("Артикулът е записан като непубликуван");
    expect(admin).toContain('setForm(current => ({ ...current, id, slugMode: "custom" }))');
  });
  it("refreshes the paginated catalogue and clears filters that could hide the saved item", () => {
    expect(admin).toContain("utils.catalogue.page.invalidate()");
    expect(admin).toContain("utils.catalogue.product.invalidate()");
    const save = admin.slice(admin.indexOf("const onSaved ="), admin.indexOf("const createProduct = trpc.admin.createProduct"));
    expect(save).toContain('setSearch("")');
    expect(save).toContain("setQualityOnly(false)");
    expect(save).toContain("setPage(1)");
  });
});
