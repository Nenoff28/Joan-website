import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("catalogue image loading", () => {
  it("defers and asynchronously decodes product-card images to avoid a bulk desktop image request burst", () => {
    const storefront = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
    expect(storefront).toContain('loading="lazy" decoding="async"');
  });

  it("uses clean image surfaces and preserves the complete product image", () => {
    const stylesheet = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    expect(stylesheet).toContain(".product-image-box { background: #fff; background-image: none;");
    expect(stylesheet).toContain(".product-image-box img { height: 100%; max-height: none; object-fit: contain;");
    expect(stylesheet).toContain(".product-gallery { background: #fff; background-image: none;");
    expect(stylesheet).toContain(".catalogue-workbench .product-image-box,");
    expect(stylesheet).toContain("background-image: none !important;");
  });
});
