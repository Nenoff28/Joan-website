import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const app = read("client/src/App.tsx");
const privacy = read("client/src/pages/Privacy.tsx");
const storefront = read("client/src/components/Storefront.tsx");
const consent = read("client/src/components/CookieConsent.tsx");
const html = read("client/index.html");
const vite = read("server/_core/vite.ts");
const prefetch = read("client/src/ssr/prefetch.ts");
const catalogueService = read("server/catalogueService.ts");
const notFound = read("client/src/pages/NotFound.tsx");
const globalCss = read("client/src/index.css");
const componentShowcase = read("client/src/pages/ComponentShowcase.tsx");

 describe("launch readiness SEO and privacy regressions", () => {
  it("exposes the dedicated Privacy Policy route with a real data-processing explanation", () => {
    expect(app).toContain('path="/privacy" component={Privacy}');
    expect(privacy).toContain("Какви данни обработваме");
    expect(privacy).toContain("Не събираме картови номера или CVV данни");
    expect(privacy).toContain('href="/contact"');
  });

  it("includes Privacy Policy in SSR metadata and sitemap", () => {
    expect(prefetch).toContain('"/privacy": ["Политика за поверителност"');
    expect(vite).toContain('"/privacy"');
  });

  it("loads optional analytics only after an explicit consent choice", () => {
    expect(html).not.toContain("VITE_ANALYTICS_ENDPOINT");
    expect(consent).toContain('localStorage.getItem(CONSENT_KEY)');
    expect(consent).toContain('choose("accepted")');
    expect(consent).toContain('choose("rejected")');
    expect(consent).toContain("loadAnalytics()");
    expect(consent).toContain("removeAnalytics()");
    expect(consent).toContain("cookie-settings-trigger");
  });

  it("keeps contact enquiries persistent and sends an owner notification", () => {
    expect(catalogueService).toContain("db.insert(contactEnquiries)");
    expect(catalogueService).toContain("await notifyOwner({ title:");
  });

  it("keeps the custom 404 useful and gives all keyboard users a visible focus indicator", () => {
    expect(notFound).toContain("PageMeta");
    expect(notFound).toContain("Към началото");
    expect(notFound).toContain("Разгледайте каталога");
    expect(globalCss).toContain(":focus-visible");
  });

  it("does not retain the broken components breadcrumb destination", () => {
    expect(componentShowcase).not.toContain('href="/components"');
  });

  it("updates client-side social metadata and keeps a privacy entry in the footer", () => {
    expect(storefront).toContain('meta[property="og:title"]');
    expect(storefront).toContain('meta[name="twitter:card"]');
    expect(storefront).toContain('href="/privacy"');
    expect(html).toContain('rel="icon"');
  });
});
