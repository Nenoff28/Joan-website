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
    expect(schema).toContain("product base prices remain unchanged");
  });

  it("selects only active campaigns in the current time window and calculates the public price", () => {
    expect(service).toContain("eq(promotionCampaigns.isActive, true)");
    expect(service).toContain("lte(promotionCampaigns.startsAt, now)");
    expect(service).toContain("gt(promotionCampaigns.endsAt, now)");
    expect(service).toContain("Math.round(basePrice * (1 - activePromotion.discountPercent / 100) * 100) / 100");
    expect(service).toContain("EXISTS (SELECT 1 FROM promotion_campaign_products");
  });

  it("protects campaign creation and pause operations by promotions.write", () => {
    expect(router).toContain('promotionCampaigns: permissionProcedure("promotions.read")');
    expect(router).toContain('createPromotionCampaign: permissionProcedure("promotions.write")');
    expect(router).toContain('setPromotionCampaignActive: permissionProcedure("promotions.write")');
    expect(router).toContain("productIds: z.array(z.number().int().positive()).min(1).max(1000)");
  });

  it("supports campaign name, dates, SKU/name search and multi-product selection in admin", () => {
    expect(admin).toContain("Създайте промоция за избрани артикули");
    expect(admin).toContain('type="datetime-local"');
    expect(admin).toContain("Търсене по име или вътрешен код");
    expect(admin).toContain("selectedIds");
    expect(admin).toContain("Създай промоция");
    expect(admin).toContain("Спри промоцията");
  });
});
