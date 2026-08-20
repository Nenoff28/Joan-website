import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const termsSource = readFileSync(resolve(root, "client/src/pages/Terms.tsx"), "utf8");
const contactSource = readFileSync(resolve(root, "client/src/pages/Contact.tsx"), "utf8");
const faqSource = readFileSync(resolve(root, "client/src/pages/FAQ.tsx"), "utf8");
const cssSource = readFileSync(resolve(root, "client/src/index.css"), "utf8");

describe("support interaction refinements", () => {
  it("keeps the complete terms reader while providing a mobile-friendly index treatment", () => {
    expect(termsSource).toContain('aria-label="Съдържание"');
    expect(cssSource).toContain(".terms-index { background: #f0f2ed; display: flex");
    expect(cssSource).toContain(".terms-section { gap: .55rem; grid-template-columns: 23px minmax(0,1fr)");
  });

  it("provides explicit live loading and success feedback for contact submissions", () => {
    expect(contactSource).toContain('aria-busy={enquiry.isPending}');
    expect(contactSource).toContain('id="contact-submission-feedback"');
    expect(contactSource).toContain("Изпращаме запитването ви към екипа на ЖОАН");
    expect(contactSource).toContain("Запитването е изпратено успешно.");
    expect(cssSource).toContain(".contact-submit-spinner");
  });

  it("makes FAQ answers keyboard-accessible toggle controls with visible expanded state", () => {
    expect(faqSource).toContain("const [openIndex, setOpenIndex] = useState<number | null>(0)");
    expect(faqSource).toContain("aria-expanded={isOpen}");
    expect(faqSource).toContain("Прибери отговора");
    expect(faqSource).toContain("Разгъни отговора");
    expect(cssSource).toContain(".faq-item.is-open .faq-answer");
  });
});
