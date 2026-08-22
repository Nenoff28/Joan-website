import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
const vite = readFileSync(resolve(process.cwd(), "server/_core/vite.ts"), "utf8");
const prefetch = readFileSync(resolve(process.cwd(), "client/src/ssr/prefetch.ts"), "utf8");
const sitemapService = readFileSync(resolve(process.cwd(), "server/catalogueService.ts"), "utf8");

describe("public SEO infrastructure", () => {
  it("uses SSR placeholders instead of a static legacy homepage canonical", () => {
    expect(html).toContain("<!--app-head-->");
    expect(html).toContain("<!--app-html-->");
    expect(html).not.toContain('href="https://joan.bg/"');
  });

  it("provides canonical, Open Graph, robots, sitemap, and SSR product metadata", () => {
    expect(vite).toContain('app.get("/robots.txt"');
    expect(vite).toContain('app.get("/sitemap.xml"');
    expect(vite).toContain('rel="canonical"');
    expect(vite).toContain('property="og:url"');
    expect(prefetch).toContain('canonicalPath: `/product/${product.slug}`');
    expect(sitemapService).toContain("getPublicSitemapEntries");
  });

  it("keeps transactional and authenticated routes out of search indexes", () => {
    expect(prefetch).toContain('path === "/checkout" || path === "/favorites" || path.startsWith("/account") || path.startsWith("/admin")');
  });
});
