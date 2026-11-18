import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { campaignPrice } from "../shared/campaignPrice";

const service = readFileSync(resolve(process.cwd(), "server/catalogueService.ts"), "utf8");

// The storefront showed the campaign price while order requests stored the full base price.
describe("campaign price is the same on the storefront and in order requests", () => {
  it("applies a percentage discount rounded to cents", () => {
    expect(campaignPrice(11.04, { discountPercent: 20, fixedPriceEur: null })).toBe(8.83);
  });
  it("prefers a fixed campaign price", () => {
    expect(campaignPrice(11.04, { discountPercent: 20, fixedPriceEur: 9.5 })).toBe(9.5);
  });
  it("returns null without a campaign or a base price", () => {
    expect(campaignPrice(11.04, undefined)).toBeNull();
    expect(campaignPrice(null, { discountPercent: 20, fixedPriceEur: null })).toBeNull();
  });
  it("is used by both the public product and createOrderRequest", () => {
    expect(service.match(/campaignPrice\(/g)?.length).toBeGreaterThanOrEqual(2);
    const order = service.slice(service.indexOf("export async function createOrderRequest"));
    expect(order.slice(0, 2500)).toContain("activePromotionsByProductIds(");
  });
});
