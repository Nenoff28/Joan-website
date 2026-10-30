import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const headerSource = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
const languageSource = readFileSync(resolve(process.cwd(), "client/src/contexts/LanguageContext.tsx"), "utf8");

describe("streamlined storefront header navigation", () => {
	it("uses an accessible icon-only category trigger connected to the mega menu", () => {
		expect(headerSource).toContain('className="catalogue-trigger masthead-catalogue-trigger"');
		expect(headerSource).toContain('aria-controls={mobileOpen ? "mobile-category-drawer" : "catalogue-mega-menu"}');
		expect(headerSource).toContain('aria-label={t("allCategories")}');
		expect(headerSource).toContain('id="catalogue-mega-menu"');
		expect(headerSource).not.toContain('className="nav-shell"');
		expect(headerSource).not.toContain('className="desktop-links"');
	});

	it("keeps informational routes out of the removed secondary header bar", () => {
		expect(headerSource).not.toContain('aria-label={language === "en" ? "Primary navigation" : "Основна навигация"}');
		expect(headerSource).not.toContain('className="desktop-links"');
		expect(headerSource).toContain('className="catalogue-trigger masthead-catalogue-trigger"');
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

  it("links express delivery to the delivery page and store to Google Maps", () => {
    expect(headerSource).toContain('href="/delivery" className="utility-delivery"');
    expect(headerSource).toContain('"Експресна доставка" : "Express delivery"');
    expect(headerSource).toContain('href="https://maps.app.goo.gl/fJW7QuQC9hL4jtqQ8"');
    expect(headerSource).toContain('language === "bg" ? "Магазин" : "Store"');
  });

  it("derives active category and subcategory states from the current route", () => {
    expect(headerSource).toContain("function activeCategoryPath(location: string, slug: string)");
    expect(headerSource).toContain('className={`mega-category-heading ${activePath ? "is-active" : ""}`}');
    expect(headerSource).toContain('className={`mobile-category-tree ${activePath ? "is-current" : ""}`}');
    expect(headerSource).toContain("aria-current={childActive ? \"page\" : undefined}");
  });

  it("does not reset a manually selected mega-menu tab during catalogue refreshes", () => {
    expect(headerSource).not.toContain("lastRouteCategorySync");
    expect(headerSource).not.toContain("manualMegaCategorySelection");
    expect(headerSource).toContain("if (!open && routeCategorySlug) setActiveMegaCategory(routeCategorySlug);");
    expect(headerSource).toContain("onClick={() => setActiveMegaCategory(category.slug)}");
  });

  it("exposes ЧЗВ through neutral desktop and mobile navigation without a promotion shortcut", () => {
    expect(headerSource).toContain('aria-label={language === "en" ? "Frequently asked questions" : "Често задавани въпроси"}>{language === "en" ? "FAQ" : "ЧЗВ"}</Link>');
    expect(headerSource).not.toContain('className="faq-nav-link"');
    expect(headerSource).toContain('Frequently asked questions');
    expect(headerSource).toContain('<Link href="/faq" onClick={() => setMobileOpen(false)}');
    expect(headerSource).not.toContain('className="promo-nav-link"');
  });
});
