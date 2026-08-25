import { describe, expect, it } from "vitest";
import { productStructuredData, safeJsonLd } from "../client/src/lib/structuredData";

describe("product structured data", () => {
  it("includes only persisted product information and serializes safely", () => {
    const product = productStructuredData({
      slug: "test-produkt",
      name: "Тестов продукт <script>",
      brand: "Марка",
      sku: "SKU-42",
      image: "/media/main.webp",
      gallery: ["/media/main.webp", "/media/detail.webp"],
      imageAlt: "Тестов продукт",
      description: "Проверено описание",
      category: "instrumenti",
      price: "12.50€",
      oldPrice: undefined,
      discount: undefined,
      availability: "В наличност",
      availabilityCode: "in_stock",
      features: [],
    });
    expect(product.sku).toBe("SKU-42");
    expect(product.image).toEqual(["/media/main.webp", "/media/detail.webp"]);
    expect(product.offers).toMatchObject({ price: "12.50", priceCurrency: "EUR", availability: "https://schema.org/InStock" });
    expect(safeJsonLd(product)).not.toContain("<script>");
    expect(safeJsonLd(product)).toContain("\\u003cscript\\u003e");
  });
});
