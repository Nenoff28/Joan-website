/** DESIGN REMINDER — Red Workshop Modernism: the demo checkout behaves like a clear work order—precise fields, visible validation, zero payment ambiguity. */
import { Layout, PageMeta } from "@/components/Storefront";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { useCatalogueProducts, type ManagedProduct } from "@/hooks/useCatalogue";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, ChevronLeft, ClipboardCheck, LockKeyhole, Minus, PackageCheck, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type FormValues = { fullName: string; email: string; phone: string; address: string; city: string; postcode: string; consent: boolean };
type FormErrors = Partial<Record<keyof FormValues, string>>;

function getCheckoutProduct(products: ManagedProduct[]) {
  const query = new URLSearchParams(window.location.search);
  const product = products.find((item) => item.slug === query.get("product")) ?? products[0];
  const requestedQuantity = Number(query.get("qty"));
  return { product, quantity: Number.isFinite(requestedQuantity) && requestedQuantity > 0 ? Math.min(requestedQuantity, 99) : 1 };
}

export default function Checkout() {
  const { language, t } = useLanguage();
  const { items, setQuantity, removeItem, normalizeSlugs, clearCart } = useCart();
  const requestedSlug = new URLSearchParams(window.location.search).get("product") ?? undefined;
  const lookupSlugs = useMemo(() => Array.from(new Set([...items.map((item) => item.slug), ...(requestedSlug ? [requestedSlug] : [])])), [items, requestedSlug]);
  const { products } = useCatalogueProducts(lookupSlugs);
  useEffect(() => normalizeSlugs(products.flatMap((product) => product.legacyPublicSlug ? [{ from: product.legacyPublicSlug, to: product.slug }] : [])), [products, normalizeSlugs]);
  const { product, quantity } = useMemo(() => getCheckoutProduct(products), [products]);
  const hasRequestedProduct = new URLSearchParams(window.location.search).has("product");
  const checkoutRows = useMemo(() => {
    const cartRows = items.flatMap((item) => {
      const cartProduct = products.find((candidate) => candidate.slug === item.slug || candidate.legacyPublicSlug === item.slug);
      return cartProduct ? [{ product: cartProduct, quantity: item.quantity }] : [];
    });
    return cartRows.length ? cartRows : hasRequestedProduct && product ? [{ product, quantity }] : [];
  }, [items, products, product, quantity, hasRequestedProduct]);
  const [values, setValues] = useState<FormValues>({ fullName: "", email: "", phone: "", address: "", city: "", postcode: "", consent: false });
  const [errors, setErrors] = useState<FormErrors>({});
  const [requestNumbers, setRequestNumbers] = useState<string[]>([]);
  const createOrderRequest = trpc.catalogue.createOrderRequest.useMutation({
    onError: () => toast(language === "bg" ? "Заявката не можа да бъде записана. Опитайте отново." : "The request could not be saved. Please try again."),
  });
  const total = checkoutRows.reduce((sum, row) => sum + (Number(row.product.price?.replace("€", "")) || 0) * row.quantity, 0);
  const flowTitle = language === "bg" ? "Заявка за доставка" : "Delivery request";
  const flowIntro = language === "bg" ? "Изпратете заявка за потвърждение. Екипът на Жоан ще провери наличността, цената и условията за доставка." : "Send a request for confirmation. The Joan team will verify availability, pricing, and delivery terms.";
  const consentLabel = language === "bg" ? "Разбирам, че това е заявка без онлайн плащане и екипът ще потвърди данните." : "I understand this is a request without online payment and the team will confirm the details.";

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) { setValues((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })); }
  function validate() {
    const next: FormErrors = {};
    if (values.fullName.trim().length < 3) next.fullName = t("validationName");
    if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = t("validationEmail");
    if ((values.phone.match(/\d/g) || []).length < 7) next.phone = t("validationPhone");
    if (values.address.trim().length < 6) next.address = t("validationAddress");
    if (values.city.trim().length < 2) next.city = t("validationCity");
    if (!/^\d{4}$/.test(values.postcode)) next.postcode = t("validationPostcode");
    if (!values.consent) next.consent = language === "bg" ? "Потвърдете, че заявката е без онлайн плащане." : "Confirm that this request has no online payment.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    const results = await Promise.all(checkoutRows.map((row) => createOrderRequest.mutateAsync({ productSlug: row.product.slug, quantity: row.quantity, fullName: values.fullName.trim(), email: values.email.trim(), phone: values.phone.trim(), address: values.address.trim(), city: values.city.trim(), postcode: values.postcode.trim() })));
    setRequestNumbers(results.map((result) => result.requestNumber));
    clearCart();
  }

  return <Layout>
    <PageMeta title={flowTitle} description={flowIntro} />
    <main className="checkout-page">
      <div className="page-frame checkout-frame">
        <div className="checkout-topline"><Link href={checkoutRows[0] ? `/product/${checkoutRows[0].product.slug}` : "/products"}><ChevronLeft size={17} /> {t("backToProduct")}</Link><span><ShieldAlert size={16} /> {t("mockSecurity")}</span></div>
        {requestNumbers.length ? <section className="checkout-success"><CheckCircle2 size={46} /><p className="eyebrow">{language === "bg" ? "Заявка за потвърждение" : "Confirmation request"}</p><h1>{language === "bg" ? "Заявката е регистрирана." : "Your request was recorded."}</h1><p>{language === "bg" ? `Номера ${requestNumbers.join(", ")}. Не е извършено онлайн плащане. Екипът на Жоан ще се свърже с Вас за потвърждение на наличност, цена и доставка.` : `References ${requestNumbers.join(", ")}. No online payment was taken. The Joan team will contact you to confirm availability, price, and delivery.`}</p><Link href="/category/instrumenti" className="button-solid">{t("continueShopping")} <ArrowRight size={18} /></Link></section> : <div className="checkout-grid">
          <section className="checkout-form-panel"><div className="checkout-panel-heading"><p className="eyebrow">{language === "bg" ? "Заявка без плащане" : "Request without payment"}</p><h1>{flowTitle}</h1><p>{flowIntro}</p></div><form noValidate onSubmit={submit}>
            <fieldset><legend><ClipboardCheck size={18} /> {t("customerDetails")}</legend><label>{t("fullName")}<input value={values.fullName} onChange={(event) => update("fullName", event.target.value)} aria-invalid={Boolean(errors.fullName)} />{errors.fullName && <small className="field-error">{errors.fullName}</small>}</label><div className="checkout-two-col"><label>{t("email")}<input type="email" value={values.email} onChange={(event) => update("email", event.target.value)} aria-invalid={Boolean(errors.email)} />{errors.email && <small className="field-error">{errors.email}</small>}</label><label>{t("phone")}<input type="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} aria-invalid={Boolean(errors.phone)} />{errors.phone && <small className="field-error">{errors.phone}</small>}</label></div></fieldset>
            <fieldset><legend><PackageCheck size={18} /> {t("deliveryAddress")}</legend><label>{t("address")}<input value={values.address} onChange={(event) => update("address", event.target.value)} aria-invalid={Boolean(errors.address)} />{errors.address && <small className="field-error">{errors.address}</small>}</label><div className="checkout-two-col"><label>{t("city")}<input value={values.city} onChange={(event) => update("city", event.target.value)} aria-invalid={Boolean(errors.city)} />{errors.city && <small className="field-error">{errors.city}</small>}</label><label>{t("postcode")}<input inputMode="numeric" maxLength={4} value={values.postcode} onChange={(event) => update("postcode", event.target.value.replace(/\D/g, ""))} aria-invalid={Boolean(errors.postcode)} />{errors.postcode && <small className="field-error">{errors.postcode}</small>}</label></div></fieldset>
            <label className="checkout-consent"><input type="checkbox" checked={values.consent} onChange={(event) => update("consent", event.target.checked)} /> <span>{consentLabel}</span></label>{errors.consent && <small className="field-error consent-error">{errors.consent}</small>}<button type="submit" className="button-solid checkout-submit" disabled={createOrderRequest.isPending || checkoutRows.length === 0}>{createOrderRequest.isPending ? (language === "bg" ? "Записване..." : "Saving...") : (language === "bg" ? "Изпрати заявката" : "Send request")} <ArrowRight size={18} /></button>
          </form></section>
            <aside className="checkout-summary"><p className="eyebrow">{t("orderSummary")}</p>{checkoutRows.length ? <><div className="checkout-cart-list">{checkoutRows.map((row) => <article className="checkout-product" key={row.product.slug}><img src={row.product.image} alt={row.product.imageAlt} /><div><p className="product-brand">{row.product.brand}</p><h2>{row.product.name}</h2><b>{row.product.price ?? t("enquiry")}</b><div className="checkout-cart-controls"><button type="button" onClick={() => setQuantity(row.product.slug, row.quantity - 1)} aria-label={`${language === "bg" ? "Намали количеството на" : "Decrease quantity for"} ${row.product.name}`}><Minus size={14} /></button><span>{row.quantity}</span><button type="button" onClick={() => setQuantity(row.product.slug, row.quantity + 1)} aria-label={`${language === "bg" ? "Увеличи количеството на" : "Increase quantity for"} ${row.product.name}`}><Plus size={14} /></button><button type="button" onClick={() => removeItem(row.product.slug)} aria-label={`${language === "bg" ? "Премахни" : "Remove"} ${row.product.name}`}><Trash2 size={14} /></button></div></div></article>)}</div><div className="checkout-total"><span>{t("total")}</span><strong>{total ? `${total.toFixed(2)}€` : t("enquiry")}</strong></div></> : <div className="checkout-cart-empty"><p>{language === "bg" ? "Количката е празна." : "Your cart is empty."}</p><Link href="/products">{language === "bg" ? "Разгледайте продуктите" : "Browse products"} <ArrowRight size={15} /></Link></div>}<div className="checkout-disclosure"><LockKeyhole size={19} /><p><b>{flowTitle}</b>{t("mockSecurity")}</p></div></aside>
        </div>}
      </div>
    </main>
  </Layout>;
}
