import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const languageSource = readFileSync(resolve(root, "client/src/contexts/LanguageContext.tsx"), "utf8");
const storefrontSource = readFileSync(resolve(root, "client/src/components/Storefront.tsx"), "utf8");
const homeSource = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
const categorySource = readFileSync(resolve(root, "client/src/pages/Category.tsx"), "utf8");
const productSource = readFileSync(resolve(root, "client/src/pages/Product.tsx"), "utf8");
const accountSource = readFileSync(resolve(root, "client/src/pages/CustomerAccount.tsx"), "utf8");
const notFoundSource = readFileSync(resolve(root, "client/src/pages/NotFound.tsx"), "utf8");
const appSource = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const stylesheetSource = readFileSync(resolve(root, "client/src/index.css"), "utf8");
const supportSources = ["About", "Contact", "Delivery", "FAQ", "Returns", "Terms"].map((name) => readFileSync(resolve(root, `client/src/pages/${name}.tsx`), "utf8")).join("\n");

describe("public English localization", () => {
  it("keeps the shared dictionary and storefront navigation bilingual", () => {
    expect(languageSource).toContain('language: "Language"');
    expect(storefrontSource).toContain('"Primary navigation"');
    expect(storefrontSource).toContain('"Frequently asked questions"');
    expect(storefrontSource).toContain('"In stock"');
    expect(storefrontSource).toContain('{language === "en" ? "Open" : "Отвори"}');
    expect(storefrontSource).toContain('{language === "en" ? "All in" : "Всички в"}');
  });

  it("localizes homepage shelves and public support pages without translating imported product records", () => {
    expect(homeSource).toContain('"Building materials"');
    expect(homeSource).toContain('"Current offers"');
    expect(homeSource).toContain('"Best sellers"');
    expect(supportSources).toContain('"Terms of use"');
    expect(supportSources).toContain('"Product returns"');
    expect(supportSources).toContain('"Frequently asked questions"');
  });

  it("localizes core catalogue controls and pagination", () => {
    expect(categorySource).toContain('"Search manufacturer"');
    expect(categorySource).toContain('"Price: low to high"');
    expect(categorySource).toContain('"Product pages"');
    expect(categorySource).toContain('"No products for the selected filter."');
  });

  it("localizes fixed Product gallery, quantity and fallback interface copy", () => {
    expect(productSource).toContain('"Zoom product image"');
    expect(productSource).toContain('"Product gallery"');
    expect(productSource).toContain('"Decrease quantity"');
    expect(productSource).toContain('"Product not found."');
    expect(productSource).toContain('"Compare product"');
  });

  it("localizes customer profile, sign-in and account-activation interface copy", () => {
    expect(accountSource).toContain('"CUSTOMER ACCOUNT"');
    expect(accountSource).toContain('"Sign in to your account."');
    expect(accountSource).toContain('"Previous orders"');
    expect(accountSource).toContain('"Activate your account"');
    expect(accountSource).toContain('"Save new password"');
  });

  it("localizes the public not-found fallback", () => {
    expect(notFoundSource).toContain('"Page not found"');
    expect(notFoundSource).toContain('"Страницата не е намерена"');
    expect(notFoundSource).toContain('"Go home"');
  });

  it("localizes the lazy-route loading fallback", () => {
    expect(appSource).toContain('{language === "en" ? "Loading…" : "Зареждане…"}');
  });

  it("keeps the visually rendered homepage hero heading in English after the toggle", () => {
    expect(stylesheetSource).toContain('html[lang="en"] .hero-content h1::before { content: "Building materials"; }');
    expect(stylesheetSource).toContain('html[lang="en"] .hero-content h1::after { content: "and tools"; }');
  });
});
