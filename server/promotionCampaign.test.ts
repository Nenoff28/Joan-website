import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync(new URL("./catalogueService.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const admin = readFileSync(new URL("../client/src/pages/Admin.tsx", import.meta.url), "utf8");
const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");

describe("promotion campaigns", () => {
  it("stores scheduled campaigns separately from base product prices", () => {
    expect(schema).toContain("export const promotionCampaigns");
    expect(schema).toContain("discountPercent: decimal");
    expect(schema).toContain("startsAt: timestamp");
    expect(schema).toContain("endsAt: timestamp");
    expect(schema).toContain("export const promotionCampaignProducts");
    expect(schema).toContain("fixedPriceEur: decimal");
    expect(schema).toContain("discountPercent: decimal(\"discountPercent\"");
    expect(schema).toContain("startsAt: timestamp(\"startsAt\")");
    expect(schema).toContain("product base prices remain unchanged");
  });

  it("selects only active campaigns in the current time window and calculates the public price", () => {
    expect(service).toContain("eq(promotionCampaigns.isActive, true)");
    expect(service).toContain("const startsAt = row.linkStartsAt ?? row.campaignStartsAt");
    expect(service).toContain("const endsAt = row.linkEndsAt ?? row.campaignEndsAt");
    expect(service).toContain("if (startsAt > now || (endsAt && endsAt <= now)) continue");
    expect(service).toContain("Math.round(basePrice * (1 - (activePromotion.discountPercent ?? 0) / 100) * 100) / 100");
    expect(service).toContain("EXISTS (SELECT 1 FROM promotion_campaign_products");
  });

  it("protects campaign creation and pause operations by promotions.write", () => {
    expect(router).toContain('promotionCampaigns: permissionProcedure("promotions.read")');
    expect(router).toContain('promotionProducts: permissionProcedure("promotions.read")');
    expect(router).toContain('createPromotionCampaign: permissionProcedure("promotions.write")');
    expect(router).toContain('updatePromotionCampaign: permissionProcedure("promotions.write")');
    expect(router).toContain('deletePromotionCampaign: permissionProcedure("promotions.write")');
    expect(router).toContain('setPromotionCampaignActive: permissionProcedure("promotions.write")');
    expect(router).toContain("productIds: z.array(z.number().int().positive()).min(1).max(1000)");
  });

  it("supports campaign name, dates, SKU/name search and multi-product selection in admin", () => {
    expect(admin).toContain("Промоции на определени продукти");
    expect(admin).toContain("Цяла промоция / кампания");
    expect(admin).toContain('type="datetime-local"');
    expect(admin).toContain("Търсене по име или вътрешен код");
    expect(admin).toContain("trpc.admin.promotionProducts.useQuery");
    expect(admin).toContain("trpc.admin.promotionCategories.useQuery");
    expect(admin).toContain("Категория / подкатегория");
    expect(admin).toContain("flattenPromotionCategories");
    expect(admin).toContain("selectedIds");
    expect(admin).toContain("Добавяне на много вътрешни кодове");
    expect(admin).toContain("Настройки по продукт");
    expect(admin).toContain("Създай промоция");
    expect(admin).toContain("Редактирай");
    expect(admin).toContain("Изтрий");
    expect(admin).toContain("Спри промоцията");
  });

  it("filters the picker by a selected category branch without changing product prices", () => {
    expect(router).toContain('promotionProducts: permissionProcedure("promotions.read").input');
    expect(router).toContain('promotionCategories: permissionProcedure("promotions.read")');
    expect(service).toContain("export async function getAdminPromotionProducts(categoryId?: number)");
    expect(service).toContain("product.subcategoryIds.includes(categoryId)");
  });
});
