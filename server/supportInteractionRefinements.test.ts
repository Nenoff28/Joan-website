import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const termsSource = readFileSync(resolve(root, "client/src/pages/Terms.tsx"), "utf8");
const contactSource = readFileSync(resolve(root, "client/src/pages/Contact.tsx"), "utf8");
const faqSource = readFileSync(resolve(root, "client/src/pages/FAQ.tsx"), "utf8");
const storefrontSource = readFileSync(resolve(root, "client/src/components/Storefront.tsx"), "utf8");
const checkoutSource = readFileSync(resolve(root, "client/src/pages/Checkout.tsx"), "utf8");
const cartContextSource = readFileSync(resolve(root, "client/src/contexts/CartContext.tsx"), "utf8");
const cssSource = readFileSync(resolve(root, "client/src/index.css"), "utf8");

describe("support interaction refinements", () => {
  it("keeps the complete terms reader while providing a mobile-friendly index treatment", () => {
    expect(termsSource).toContain('aria-label={en ? "Contents" : "Съдържание"}');
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

  it("keeps an explicit checkout route without retaining the stale catalogue slug", () => {
    expect(storefrontSource).toContain('href="/checkout" className="mini-cart-checkout"');
    expect(storefrontSource).toContain('<Link href="/checkout">{t("checkoutNav")}</Link>');
    expect(storefrontSource).not.toContain("rtrmax-bormashina-udarna-710w-13mm-x-lion");
  });

  it("keeps the product-search workflow available in the mobile drawer", () => {
    expect(storefrontSource).toContain('id="mobile-site-search"');
    expect(storefrontSource).toContain('className="mobile-search-results"');
    expect(cssSource).toContain(".mobile-search-wrap");
  });

  it("provides persistent cart state and accessible mini-cart quantity and removal controls", () => {
    expect(cartContextSource).toContain('const CART_STORAGE_KEY = "joan-cart"');
    expect(cartContextSource).toContain("addItem");
    expect(cartContextSource).toContain("setQuantity");
    expect(storefrontSource).toContain('id="header-mini-cart"');
    expect(storefrontSource).toContain('className="mini-cart-quantity"');
    expect(storefrontSource).toContain("onRemove={removeItem}");
    expect(cssSource).toContain(".mini-cart-checkout");
  });

  it("renders every persisted cart line in checkout with its own editable quantity", () => {
    expect(checkoutSource).toContain("const checkoutRows = useMemo");
    expect(checkoutSource).toContain('className="checkout-cart-controls"');
    expect(checkoutSource).toContain("items: checkoutRows.map");
    expect(checkoutSource).not.toContain("Promise.all(checkoutRows.map");
    expect(checkoutSource).toContain('checkoutRows.length === 0');
  });

  it("uses the concise delivery label in the header", () => {
    expect(storefrontSource).toContain('"Експресна доставка" : "Express delivery"');
    expect(storefrontSource).not.toContain("Експресна доставка след потвърждение от оператор");
  });
});
