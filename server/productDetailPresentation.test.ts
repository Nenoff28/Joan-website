import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productPage = readFileSync(resolve(process.cwd(), "client/src/pages/Product.tsx"), "utf8");
const catalogueService = readFileSync(resolve(process.cwd(), "server/catalogueService.ts"), "utf8");
const stylesheet = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("product detail presentation", () => {
  it("keeps the full primary image inside a contain-based gallery stage", () => {
    expect(productPage).toContain('className="gallery-stage"');
    expect(stylesheet).toContain('.product-gallery .gallery-stage > img { max-height: 100%; max-width: 100%; object-fit: contain; width: 100%; }');
  });

  it("uses a four-item recommendation carousel with accessible rotation controls", () => {
    expect(catalogueService).toContain('.limit(16)');
    expect(productPage).toContain('const carouselSize = Math.min(4, related.length);');
    expect(productPage).toContain('className="related-carousel-track"');
    expect(productPage).toContain('Show next recommendations');
    expect(stylesheet).toContain('.related-carousel-track { display: grid; gap: .75rem; grid-template-columns: repeat(4, minmax(0, 1fr)); }');
  });

  it("passes a matching manufacturer logo to the product detail with text fallback", () => {
    expect(catalogueService).toContain('catalogueManufacturers');
    expect(catalogueService).toContain('brandLogo: brandLogo ?? undefined');
    expect(catalogueService).toContain('row.manufacturer?.officialLogoUrl');
    expect(catalogueService).not.toContain('row.manufacturer?.imageUrl');
    expect(productPage).toContain('className="product-brand-logo"');
    expect(productPage).toContain('setFailedBrandLogo(product.brandLogo)');
  });
});
