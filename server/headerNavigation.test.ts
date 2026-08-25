import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const headerSource = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
const languageSource = readFileSync(resolve(process.cwd(), "client/src/contexts/LanguageContext.tsx"), "utf8");

describe("streamlined storefront header navigation", () => {
  it("uses an accessible icon-only category trigger connected to the mega menu", () => {
    expect(headerSource).toContain('className="catalogue-trigger"');
    expect(headerSource).toContain('aria-controls="catalogue-mega-menu"');
    expect(headerSource).toContain('aria-label={t("allCategories")}');
    expect(headerSource).toContain('id="catalogue-mega-menu"');
  });

  it("keeps category routes inside the category menu rather than duplicating them in the desktop links", () => {
    const desktopNav = headerSource.match(/<nav aria-label=\{language === "en" \? "Primary navigation" : "Основна навигация"\} className="desktop-links">([\s\S]*?)<\/nav>/)?.[1] ?? "";
    expect(desktopNav).toContain('href="/"');
    expect(desktopNav).toContain('href="/about"');
    expect(desktopNav).toContain('href="/contact"');
    expect(desktopNav).toContain('href="/faq"');
    expect(desktopNav).not.toContain('href="/category/instrumenti"');
    expect(desktopNav).not.toContain('href="/category/gradina"');
    expect(desktopNav).not.toContain('href="/category/stroitelstvo"');
    expect(desktopNav).not.toContain('href="/category/boi-lakove-mazilki"');
  });

  it("uses the requested Bulgarian labels for the informational header routes", () => {
    expect(languageSource).toContain('about: "За нас"');
    expect(languageSource).toContain('storeContacts: "Контакти"');
  });

  it("uses the concise catalogue label and plus-controlled nested category disclosures", () => {
    expect(languageSource).toContain('catalogue: "Каталог"');
    expect(languageSource).not.toContain('catalogue: "Каталог Жоан"');
    expect(headerSource).toContain('mega-category-group ${groupActive ? "is-active" : ""}');
    expect(headerSource).toContain('<Plus size={15} aria-hidden="true" />');
    expect(headerSource).toContain('mobile-category-branch ${groupActive ? "is-active" : ""}');
  });

  it("derives active category and subcategory states from the current route", () => {
    expect(headerSource).toContain("function activeCategoryPath(location: string, slug: string)");
    expect(headerSource).toContain('className={`mega-category-heading ${activePath ? "is-active" : ""}`}');
    expect(headerSource).toContain('className={`mobile-category-tree ${activePath ? "is-current" : ""}`}');
    expect(headerSource).toContain("aria-current={childActive ? \"page\" : undefined}");
  });

  it("exposes ЧЗВ through neutral desktop and mobile navigation without a promotion shortcut", () => {
    expect(headerSource).toContain('aria-label={language === "en" ? "Frequently asked questions" : "Често задавани въпроси"}>{language === "en" ? "FAQ" : "ЧЗВ"}</Link>');
    expect(headerSource).not.toContain('className="faq-nav-link"');
    expect(headerSource).toContain('Frequently asked questions');
    expect(headerSource).toContain('<Link href="/faq" onClick={() => setMobileOpen(false)}');
    expect(headerSource).not.toContain('className="promo-nav-link"');
  });
});
