import { and } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it } from "vitest";
import { publicCatalogueConditions, publicCataloguePromotionPredicate } from "./catalogueService";

describe("public catalogue promotion filter", () => {
  const dialect = new MySqlDialect();
  const render = (condition: ReturnType<typeof publicCataloguePromotionPredicate>) => dialect.sqlToQuery(condition).sql;

  it("renders the real MySQL predicate for a valid old price or a nonempty trimmed label", () => {
    const sql = render(publicCataloguePromotionPredicate());

    expect(sql).toMatch(/`catalogue_products`\.`oldPriceEur` is not null/);
    expect(sql).toMatch(/`catalogue_products`\.`priceEur` is not null/);
    expect(sql).toMatch(/`catalogue_products`\.`oldPriceEur` > `catalogue_products`\.`priceEur`/);
    expect(sql).toMatch(/TRIM\(COALESCE\(`catalogue_products`\.`discountLabel`, ''\)\) <> ''/);
    expect(sql).toMatch(/ or /i);
  });

  it("adds promotion filtering without dropping the shared active catalogue conditions", () => {
    const conditions = publicCatalogueConditions({ page: 1, pageSize: 24, promotion: true, availability: ["in_stock"] });
    const sql = dialect.sqlToQuery(and(...conditions)!).sql;

    expect(sql).toContain("`catalogue_products`.`isActive` = ?");
    expect(sql).toContain("`catalogue_categories`.`isActive` = ?");
    expect(sql).toContain("`catalogue_products`.`availability` in (?)");
    expect(sql).toContain("TRIM(COALESCE(`catalogue_products`.`discountLabel`, '')")
  });

  it("leaves the shared conditions unchanged when promotion is false or omitted", () => {
    const withoutPromotion = dialect.sqlToQuery(and(...publicCatalogueConditions({ page: 1, pageSize: 24 }))!).sql;
    const falsePromotion = dialect.sqlToQuery(and(...publicCatalogueConditions({ page: 1, pageSize: 24, promotion: false }))!).sql;

    expect(withoutPromotion).toBe(falsePromotion);
    expect(withoutPromotion).not.toContain("oldPriceEur");
    expect(withoutPromotion).not.toContain("discountLabel");
  });
});
