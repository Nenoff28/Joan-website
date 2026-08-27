import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("catalogue image loading", () => {
  it("defers and asynchronously decodes product-card images to avoid a bulk desktop image request burst", () => {
    const storefront = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
    expect(storefront).toContain('loading="lazy" decoding="async"');
  });
});
