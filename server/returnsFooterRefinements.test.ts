import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const storefrontSource = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
const returnsSource = readFileSync(resolve(process.cwd(), "client/src/pages/Returns.tsx"), "utf8");
const faqSource = readFileSync(resolve(process.cwd(), "client/src/pages/FAQ.tsx"), "utf8");
const cssSource = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("returns FAQ and footer refinements", () => {
  it("keeps the footer return action as a real route instead of a payment-security toast", () => {
    expect(storefrontSource).toContain('<Link href="/returns">{language === "en" ? "Return an order" : "Връщане на поръчка"}</Link>');
    expect(storefrontSource).not.toContain('onClick={() => toast(t("mockSecurity"))}>{t("returns")}');
    expect(storefrontSource).not.toContain('footer-return-link');
  });

  it("keeps the FAQ content on a distinct dedicated route instead of the returns page", () => {
    expect(returnsSource).not.toContain("Какво е входящ номер за връщане (RMA)?");
    expect(returnsSource).toContain('href="/faq" className="returns-faq-route"');
    expect(faqSource).toContain("Често задавани въпроси");
    expect(faqSource).toContain("Какво е входящ номер за връщане (RMA)?");
    expect(faqSource).toContain("Мога ли да изпратя продукта веднага?");
  });

  it("groups the supplied accessible Facebook link and map destination with the left contact details", () => {
    expect(storefrontSource).toContain('className="footer-facebook"');
    expect(storefrontSource).toContain('aria-label="Joan on Facebook"');
    expect(storefrontSource).toContain('Joan on Instagram — profile coming soon');
    expect(storefrontSource).toContain('Joan on TikTok — profile coming soon');
    expect(storefrontSource).toContain('src="/manus-storage/joan-facebook-alpha-transparent_00d72f60.png"');
    expect(storefrontSource).toContain('src="/manus-storage/joan-instagram-alpha-transparent_ad89717c.png"');
    expect(storefrontSource).toContain('src="/manus-storage/joan-tiktok-replacement-transparent_e8932721.png"');
    expect(storefrontSource).toContain('alt="Joan on Facebook"');
    expect(storefrontSource).toContain('href="https://maps.app.goo.gl/fJW7QuQC9hL4jtqQ8"');
    expect(storefrontSource).toContain('className="footer-contact-line footer-map-link"');
    expect(storefrontSource).not.toContain('className="footer-contact-list"');
    expect(storefrontSource).not.toContain('footer-contact-action');
    expect(cssSource).toContain('.footer-facebook, .footer-social-placeholder');
    expect(cssSource).toContain('scale(1.1)');
    expect(cssSource).toContain('prefers-reduced-motion: reduce');
    expect(cssSource).toContain('--footer-social-control: 23.5px');
    expect(cssSource).toContain('transform: scale(1.22)');
    expect(cssSource).toContain("footer-social-placeholder:last-child img { transform: scale(1.48)");
    expect(cssSource).toContain(".footer-facebook img");
    expect(cssSource).toContain(".footer-bottom { color: #dbe3de; }");
  });

  it("keeps the logo/contact block and renders the requested three readable footer columns", () => {
    expect(storefrontSource).toContain('className="footer-brand"');
    expect(storefrontSource).toContain('aria-labelledby="footer-customers-title"');
    expect(storefrontSource).toContain('aria-labelledby="footer-joan-title"');
    expect(storefrontSource).toContain('aria-labelledby="footer-information-title"');
    expect(storefrontSource).toContain('За клиенти');
    expect(storefrontSource).toContain('Обща информация');
    expect(storefrontSource).toContain('className="footer-link-button"');
    expect(storefrontSource).not.toContain('Подредени категории за ремонт, дом, градина и професионална работа.');
    expect(storefrontSource).not.toContain('Онлайн каталог с потвърждение на наличност и доставка от екипа на Жоан.');
    expect(cssSource).toContain('.footer-main h3 { color: white; }');
    expect(cssSource).toContain('.footer-main > div:not(.footer-brand) a, .footer-main > div:not(.footer-brand) button { color: #e4ebe7; }');
    expect(cssSource).toContain('.footer-main > nav { align-content: start; display: grid; gap: .55rem; }');
    expect(cssSource).toContain('.footer-main > nav a, .footer-main > nav button { color: #fff;');
    expect(cssSource).not.toContain('.site-footer { background: #f3f4f1;');
  });
});
