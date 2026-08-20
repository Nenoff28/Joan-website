import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const storefrontSource = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
const returnsSource = readFileSync(resolve(process.cwd(), "client/src/pages/Returns.tsx"), "utf8");
const faqSource = readFileSync(resolve(process.cwd(), "client/src/pages/FAQ.tsx"), "utf8");
const cssSource = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("returns FAQ and footer refinements", () => {
  it("keeps the footer return action as a real route instead of a payment-security toast", () => {
    expect(storefrontSource).toContain('<Link href="/returns" className="footer-return-link">{t("returns")}</Link>');
    expect(storefrontSource).not.toContain('onClick={() => toast(t("mockSecurity"))}>{t("returns")}');
  });

  it("keeps the FAQ content on a distinct dedicated route instead of the returns page", () => {
    expect(returnsSource).not.toContain("Какво е входящ номер за връщане (RMA)?");
    expect(returnsSource).toContain('href="/faq" className="returns-faq-route"');
    expect(faqSource).toContain("Често задавани въпроси");
    expect(faqSource).toContain("Какво е входящ номер за връщане (RMA)?");
    expect(faqSource).toContain("Мога ли да изпратя продукта веднага?");
  });

  it("uses higher-contrast footer text and the supplied accessible icon-only Facebook link", () => {
    expect(storefrontSource).toContain('className="footer-facebook"');
    expect(storefrontSource).toContain('aria-label="Facebook на ЖОАН"');
    expect(storefrontSource).toContain('src="/manus-storage/joan-facebook-icon_f29d2620.webp"');
    expect(storefrontSource).toContain('alt=""');
    expect(cssSource).toContain(".footer-facebook img");
    expect(cssSource).toContain(".footer-bottom { color: #dbe3de; }");
  });
});
