import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const storefrontSource = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
const prefetchSource = readFileSync(resolve(process.cwd(), "client/src/ssr/prefetch.ts"), "utf8");
const htmlTemplate = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");

describe("homepage SEO audit regressions", () => {
  it("uses the same relevant construction-material keywords in title, description, and H1", () => {
    expect(homeSource).toContain('title="Строителни материали и инструменти"');
    expect(homeSource).toContain("ЖОАН в Силистра: строителни материали, инструменти");
    expect(homeSource).toContain("<h1>Строителни материали<br /><span>и инструменти</span></h1>");
    expect(prefetchSource).toContain("HOME_TITLE");
    expect(prefetchSource).toContain("HOME_DESCRIPTION");
  });

  it("keeps client-side canonical URLs free of tracking query parameters", () => {
    expect(storefrontSource).toContain('canonicalUrl || `${window.location.origin}${window.location.pathname}`');
  });

  it("provides non-empty descriptions for homepage category, brochure, social, and product images", () => {
    expect(homeSource).toContain('alt={`${brochureTitle} — предишна страница`}');
    expect(homeSource).toContain('alt={`${category.label} — ${category.description}`}');
    expect(storefrontSource).toContain('alt={product.imageAlt || product.name}');
    expect(storefrontSource).toContain('alt="Facebook на ЖОАН"');
  });

  it("starts independent homepage SSR queries before awaiting metadata", () => {
    expect(prefetchSource).toContain("const metadataPromise = prefetch.metadata()");
    expect(prefetchSource).toContain("const headerSearchPromise = prefetch.page(headerSearch)");
  });

  it("includes useful catalogue guidance, a textual label for the icon-only link, and an Apple touch icon", () => {
    expect(homeSource).toContain("<HomeCatalogueGuide />");
    expect(readFileSync(resolve(process.cwd(), "client/src/components/HomeCatalogueGuide.tsx"), "utf8")).toContain("Изберете материали и инструменти според задачата.");
    expect(homeSource).toContain("Строителни материали за ремонт");
    expect(homeSource).toContain('className="sr-only">Към продуктовото търсене</span>');
    expect(htmlTemplate).toContain('rel="apple-touch-icon"');
  });
});
