import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const storefrontSource = readFileSync(resolve(process.cwd(), "client/src/components/Storefront.tsx"), "utf8");
const returnsSource = readFileSync(resolve(process.cwd(), "client/src/pages/Returns.tsx"), "utf8");
const faqSource = readFileSync(resolve(process.cwd(), "client/src/pages/FAQ.tsx"), "utf8");
const cssSource = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("returns FAQ and footer refinements", () => {
  it("keeps the footer return action as a real route instead of a payment-security toast", () => {
    expect(storefrontSource).toContain('<Link href="/returns">{t("returns")}</Link>');
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
    expect(storefrontSource).toContain('aria-label="Facebook на ЖОАН"');
    expect(storefrontSource).toContain('aria-label="Instagram на ЖОАН — профилът предстои"');
    expect(storefrontSource).toContain('aria-label="TikTok на ЖОАН — профилът предстои"');
    expect(storefrontSource).toContain('src="/manus-storage/joan-instagram-icon-transparent_5e41fbb5.png"');
    expect(storefrontSource).toContain('src="/manus-storage/joan-tiktok-replacement-transparent_e8932721.png"');
    expect(storefrontSource).toContain('src="/manus-storage/joan-facebook-icon_f29d2620.webp"');
    expect(storefrontSource).toContain('alt=""');
    expect(storefrontSource).toContain('href="https://maps.app.goo.gl/fJW7QuQC9hL4jtqQ8"');
    expect(storefrontSource).toContain('className="footer-contact-line footer-map-link"');
    expect(storefrontSource).not.toContain('className="footer-contact-list"');
    expect(storefrontSource).not.toContain('footer-contact-action');
    expect(cssSource).toContain('.footer-facebook, .footer-social-placeholder');
    expect(cssSource).toContain('scale(1.1)');
    expect(cssSource).toContain('prefers-reduced-motion: reduce');
    expect(cssSource).toContain(".footer-facebook img");
    expect(cssSource).toContain(".footer-bottom { color: #dbe3de; }");
  });
});
