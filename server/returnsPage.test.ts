import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const storefrontSource = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
const returnsSource = readFileSync(resolve(process.cwd(), "client/src/pages/Returns.tsx"), "utf8");
const cssSource = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("returns information and back-to-top interaction", () => {
  it("provides a dedicated public returns route and footer link", () => {
    expect(appSource).toContain('path={"/returns"} component={Returns}');
    expect(storefrontSource).toContain('<Link href="/returns">{t("returns")}</Link>');
    expect(returnsSource).toContain('title={en ? "Product returns" : "Връщане на продукти"}');
  });

  it("keeps return information accurate to the original public workflow without claiming a live submission", () => {
    expect(returnsSource).toContain('14 {en ? "days" : "дни"}');
    expect(returnsSource).toContain("входящ номер за връщане (RMA)");
    expect(returnsSource).toContain("This is an information page");
    expect(returnsSource).toContain("originalTermsUrl");
  });

  it("adds an accessible back-to-top control with smooth user-initiated motion and reduced-motion support", () => {
    expect(storefrontSource).toContain("function BackToTop()");
    expect(storefrontSource).toContain('window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })');
    expect(storefrontSource).toContain("aria-label={label}");
    expect(cssSource).toContain(".back-to-top");
    expect(cssSource).toContain("@media (prefers-reduced-motion: reduce) { .back-to-top");
  });
});
