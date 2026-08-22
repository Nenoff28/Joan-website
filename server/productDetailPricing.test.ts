import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productSource = readFileSync(resolve(process.cwd(), "client/src/pages/Product.tsx"), "utf8");
const stylesSource = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("public product-detail price presentation", () => {
  it("uses a promotional heading only when the product has a verified previous EUR price", () => {
    expect(productSource).toContain('const priceLabel = product?.oldPrice ? t("promotionalPrice") : language === "bg" ? "Цена" : "Price";');
    expect(productSource).toContain("<p>{priceLabel}</p>");
  });

  it("suppresses the internal product-detail implementation marker from public rendering", () => {
    expect(stylesSource).toContain(".product-detail::before { content: none; }");
  });
});
