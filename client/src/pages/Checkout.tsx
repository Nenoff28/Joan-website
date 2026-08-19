/** DESIGN REMINDER — Red Workshop Modernism: the demo checkout behaves like a clear work order—precise fields, visible validation, zero payment ambiguity. */
import { Layout, PageMeta } from "@/components/Storefront";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCatalogue } from "@/hooks/useCatalogue";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, ChevronLeft, ClipboardCheck, LockKeyhole, PackageCheck, ShieldAlert } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type FormValues = { fullName: string; email: string; phone: string; address: string; city: string; postcode: string; consent: boolean };
type FormErrors = Partial<Record<keyof FormValues, string>>;

function getCheckoutProduct(products: ReturnType<typeof useCatalogue>["products"]) {
  const query = new URLSearchParams(window.location.search);
  const product = products.find((item) => item.slug === query.get("product")) ?? products[0];
  const requestedQuantity = Number(query.get("qty"));
  return { product, quantity: Number.isFinite(requestedQuantity) && requestedQuantity > 0 ? Math.min(requestedQuantity, 99) : 1 };
}

export default function Checkout() {
  const { language, t } = useLanguage();
  const { products } = useCatalogue();
  const { product, quantity } = useMemo(() => getCheckoutProduct(products), [products]);
  const [values, setValues] = useState<FormValues>({ fullName: "", email: "", phone: "", address: "", city: "", postcode: "", consent: false });
  const [errors, setErrors] = useState<FormErrors>({});
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const createOrderRequest = trpc.catalogue.createOrderRequest.useMutation({
    onSuccess: (result) => setRequestNumber(result.requestNumber),
    onError: () => toast(language === "bg" ? "Заявката не можа да бъде записана. Опитайте отново." : "The request could not be saved. Please try again."),
  });
  const numericPrice = product.price ? Number(product.price.replace("€", "")) : 0;
  const total = (numericPrice * quantity).toFixed(2);
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
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    createOrderRequest.mutate({ productSlug: product.slug, quantity, fullName: values.fullName.trim(), email: values.email.trim(), phone: values.phone.trim(), address: values.address.trim(), city: values.city.trim(), postcode: values.postcode.trim() });
  }

  return <Layout>
    <PageMeta title={flowTitle} description={flowIntro} />
    <main className="checkout-page">
      <div className="page-frame checkout-frame">
        <div className="checkout-topline"><Link href={`/product/${product.slug}`}><ChevronLeft size={17} /> {t("backToProduct")}</Link><span><ShieldAlert size={16} /> {t("mockSecurity")}</span></div>
        {requestNumber ? <section className="checkout-success"><CheckCircle2 size={46} /><p className="eyebrow">{language === "bg" ? "Заявка за потвърждение" : "Confirmation request"}</p><h1>{language === "bg" ? "Заявката е регистрирана." : "Your request was recorded."}</h1><p>{language === "bg" ? `Номер ${requestNumber}. Не е извършено онлайн плащане. Екипът на Жоан ще се свърже с Вас за потвърждение на наличност, цена и доставка.` : `Reference ${requestNumber}. No online payment was taken. The Joan team will contact you to confirm availability, price, and delivery.`}</p><Link href="/category/instrumenti" className="button-solid">{t("continueShopping")} <ArrowRight size={18} /></Link></section> : <div className="checkout-grid">
          <section className="checkout-form-panel"><div className="checkout-panel-heading"><p className="eyebrow">{language === "bg" ? "Заявка без плащане" : "Request without payment"}</p><h1>{flowTitle}</h1><p>{flowIntro}</p></div><form noValidate onSubmit={submit}>
            <fieldset><legend><ClipboardCheck size={18} /> {t("customerDetails")}</legend><label>{t("fullName")}<input value={values.fullName} onChange={(event) => update("fullName", event.target.value)} aria-invalid={Boolean(errors.fullName)} />{errors.fullName && <small className="field-error">{errors.fullName}</small>}</label><div className="checkout-two-col"><label>{t("email")}<input type="email" value={values.email} onChange={(event) => update("email", event.target.value)} aria-invalid={Boolean(errors.email)} />{errors.email && <small className="field-error">{errors.email}</small>}</label><label>{t("phone")}<input type="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} aria-invalid={Boolean(errors.phone)} />{errors.phone && <small className="field-error">{errors.phone}</small>}</label></div></fieldset>
            <fieldset><legend><PackageCheck size={18} /> {t("deliveryAddress")}</legend><label>{t("address")}<input value={values.address} onChange={(event) => update("address", event.target.value)} aria-invalid={Boolean(errors.address)} />{errors.address && <small className="field-error">{errors.address}</small>}</label><div className="checkout-two-col"><label>{t("city")}<input value={values.city} onChange={(event) => update("city", event.target.value)} aria-invalid={Boolean(errors.city)} />{errors.city && <small className="field-error">{errors.city}</small>}</label><label>{t("postcode")}<input inputMode="numeric" maxLength={4} value={values.postcode} onChange={(event) => update("postcode", event.target.value.replace(/\D/g, ""))} aria-invalid={Boolean(errors.postcode)} />{errors.postcode && <small className="field-error">{errors.postcode}</small>}</label></div></fieldset>
            <label className="checkout-consent"><input type="checkbox" checked={values.consent} onChange={(event) => update("consent", event.target.checked)} /> <span>{consentLabel}</span></label>{errors.consent && <small className="field-error consent-error">{errors.consent}</small>}<button type="submit" className="button-solid checkout-submit" disabled={createOrderRequest.isPending}>{createOrderRequest.isPending ? (language === "bg" ? "Записване..." : "Saving...") : (language === "bg" ? "Изпрати заявката" : "Send request")} <ArrowRight size={18} /></button>
          </form></section>
          <aside className="checkout-summary"><p className="eyebrow">{t("orderSummary")}</p><div className="checkout-product"><img src={product.image} alt={product.imageAlt} /><div><p className="product-brand">{product.brand}</p><h2>{product.name}</h2><span>{t("quantity")}: {quantity}</span></div></div><div className="checkout-line"><span>{t("item")}</span><b>{product.price ?? t("enquiry")}</b></div><div className="checkout-line"><span>{t("quantity")}</span><b>× {quantity}</b></div><div className="checkout-total"><span>{t("total")}</span><strong>{numericPrice ? `${total}€` : t("enquiry")}</strong></div><div className="checkout-disclosure"><LockKeyhole size={19} /><p><b>{flowTitle}</b>{t("mockSecurity")}</p></div></aside>
        </div>}
      </div>
    </main>
  </Layout>;
}
