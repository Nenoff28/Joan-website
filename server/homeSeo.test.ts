import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const storefrontSource = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
const prefetchSource = readFileSync(resolve(process.cwd(), "client/src/ssr/prefetch.ts"), "utf8");
const htmlTemplate = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");

describe("homepage SEO audit regressions", () => {
  it("uses the same relevant construction-material keywords in title, description, and H1", () => {
    expect(homeSource).toContain('title={en ? "Building materials" : "Строителни материали"}');
    expect(homeSource).toContain("ЖОАН в Силистра: строителни материали, продукти за дома и градината.");
    expect(homeSource).toContain('<h1>{en ? "Building materials" : "Строителни материали"}</h1>');
    expect(prefetchSource).toContain("HOME_TITLE");
    expect(prefetchSource).toContain("HOME_DESCRIPTION");
  });

  it("keeps client-side canonical URLs free of tracking query parameters", () => {
    expect(storefrontSource).toContain('canonicalUrl || `${window.location.origin}${window.location.pathname}`');
  });

  it("provides non-empty descriptions for homepage category, brochure, social, and product images", () => {
    expect(homeSource).toContain('alt={`${brochureTitle} — ${en ? "previous page" : "предишна страница"}`}');
    expect(homeSource).toContain('alt={`${category.label} — ${category.description}`}');
    expect(storefrontSource).toContain('alt={product.imageAlt || product.name}');
    expect(storefrontSource).toContain('alt="Joan on Facebook"');
  });

  it("starts independent homepage SSR queries before awaiting metadata", () => {
    expect(prefetchSource).toContain("const metadataPromise = prefetch.metadata()");
    expect(prefetchSource).toContain("const headerSearchPromise = prefetch.page(headerSearch)");
  });

  it("keeps the homepage focused after removing the guide and company-statistic blocks", () => {
    expect(homeSource).not.toContain("<HomeCatalogueGuide />");
    expect(homeSource).not.toContain('className="project-bay"');
    expect(homeSource).not.toContain('className="page-frame company-split"');
    expect(htmlTemplate).toContain('rel="apple-touch-icon"');
  });

  it("moves the Joan video to About and keeps category cards unnumbered and colour-treated", () => {
    const aboutSource = readFileSync(resolve(process.cwd(), "client/src/pages/About.tsx"), "utf8");
    const stylesheet = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    expect(homeSource).not.toContain('className="hero-video"');
    expect(aboutSource).toContain('className="about-video"');
    expect(aboutSource).toContain('src="/manus-storage/joan-hero_0c2a067a.mp4"');
    expect(stylesheet).toContain('.feature-category-card::before, .feature-category-card::after, .all-category-grid .feature-category-card::before, .all-category-grid .feature-category-card::after { content: none !important; }');
    expect(stylesheet).toContain('filter: saturate(1.95) brightness(1.42) contrast(1.02) !important;');
    expect(stylesheet).toContain('background: linear-gradient(0deg, rgba(16,28,27,.42), rgba(16,28,27,0) 78%) !important;');
  });

  it("renders 12 current catalogue products and 8 historically ordered best sellers before the brochure", () => {
    expect(homeSource).toContain('title={en ? "Current offers" : "Актуални предложения"}');
    expect(homeSource).toContain('featuredProducts.products.slice(0, 12)');
    expect(homeSource).toContain('title={en ? "Best sellers" : "Най-продавани"}');
    expect(homeSource).toContain('(bestSellersQuery.data ?? []).slice(0, 8)');
    expect(homeSource.indexOf('title={en ? "Current offers" : "Актуални предложения"}')).toBeLessThan(homeSource.indexOf('id="brochure"'));
    expect(homeSource.indexOf('title={en ? "Best sellers" : "Най-продавани"}')).toBeLessThan(homeSource.indexOf('id="brochure"'));
  });
});
