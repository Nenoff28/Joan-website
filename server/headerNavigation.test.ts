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
    const desktopNav = headerSource.match(/<nav aria-label="Основна навигация" className="desktop-links">([\s\S]*?)<\/nav>/)?.[1] ?? "";
    expect(desktopNav).toContain('href="/"');
    expect(desktopNav).toContain('href="/about"');
    expect(desktopNav).toContain('href="/contact"');
    expect(desktopNav).not.toContain('href="/category/instrumenti"');
    expect(desktopNav).not.toContain('href="/category/gradina"');
    expect(desktopNav).not.toContain('href="/category/stroitelstvo"');
    expect(desktopNav).not.toContain('href="/category/boi-lakove-mazilki"');
  });

  it("uses the requested Bulgarian labels for the informational header routes", () => {
    expect(languageSource).toContain('about: "За нас"');
    expect(languageSource).toContain('storeContacts: "Контакти"');
  });
});
