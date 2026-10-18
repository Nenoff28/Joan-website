import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Product.tsx"), "utf8");
const info = source.slice(source.indexOf('<div className="product-detail-info">'), source.indexOf('<div className="operational-spec-strip">'));

describe("product model label", () => {
  it("uses the internal code rather than technical characteristics below the heading", () => {
    expect(info).toContain('language === "en" ? "Model" : "Модел"');
    expect(info).toContain(": {product.sku}");
    expect(info).not.toContain("product.features.map");
  });

  it("hides the model badge if no internal code exists", () => {
    expect(info).toContain("product.sku?.trim() &&");
  });

  it("retains technical specifications in their separate section", () => {
    expect(source).toContain("technicalSpecs.map((specification, index)");
    expect(source).toContain('t("technicalData")');
    expect(source).toContain("product.features.map((value)");
  });
});
