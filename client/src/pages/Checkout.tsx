/** DESIGN REMINDER — Red Workshop Modernism: the demo checkout behaves like a clear work order—precise fields, visible validation, zero payment ambiguity. */
import { Layout, PageMeta } from "@/components/Storefront";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import {
  useCatalogueProducts,
  type ManagedProduct,
} from "@/hooks/useCatalogue";
import { bulgarianLocations } from "@/lib/bulgarianLocations";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  LockKeyhole,
  Minus,
  PackageCheck,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { toast } from "sonner";

type FormValues = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  region: string;
  city: string;
  postcode: string;
  locationKey: string;
  invoiceRequested: boolean;
  invoiceCompanyName: string;
  invoiceEik: string;
  invoiceVatNumber: string;
  invoiceMol: string;
  invoiceRegion: string;
  invoiceCity: string;
  invoiceLocationKey: string;
  invoicePostcode: string;
  invoiceAddress: string;
  invoiceAddressAdditional: string;
  invoiceAdditionalInfo: string;
  consent: boolean;
};
type FormErrors = Partial<Record<keyof FormValues, string>>;

function getCheckoutProduct(products: ManagedProduct[], search: string) {
  const query = new URLSearchParams(search);
  const product =
    products.find(item => item.slug === query.get("product")) ?? products[0];
  const requestedQuantity = Number(query.get("qty"));
  return {
    product,
    quantity:
      Number.isFinite(requestedQuantity) && requestedQuantity > 0
        ? Math.min(requestedQuantity, 99)
        : 1,
  };
}

function normalizeLocationQuery(value: string) {
  return value.trim().toLocaleLowerCase("bg-BG");
}

function locationLabel(location: (typeof bulgarianLocations)[number]) {
  return `${location.type} ${location.name}`;
}

export default function Checkout() {
  const { language, t } = useLanguage();
  const { items, setQuantity, removeItem, normalizeSlugs, clearCart } =
    useCart();
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const requestedSlug = searchParams.get("product") ?? undefined;
  const lookupSlugs = useMemo(
    () =>
      Array.from(
        new Set([
          ...items.map(item => item.slug),
          ...(requestedSlug ? [requestedSlug] : []),
        ])
      ),
    [items, requestedSlug]
  );
  const { products } = useCatalogueProducts(lookupSlugs);
  useEffect(
    () =>
      normalizeSlugs(
        products.flatMap(product =>
          product.legacyPublicSlug
            ? [{ from: product.legacyPublicSlug, to: product.slug }]
            : []
        )
      ),
    [products, normalizeSlugs]
  );
  const { product, quantity } = useMemo(
    () => getCheckoutProduct(products, search),
    [products, search]
  );
  const hasRequestedProduct = searchParams.has("product");
  const checkoutRows = useMemo(() => {
    const cartRows = items.flatMap(item => {
      const cartProduct = products.find(
        candidate =>
          candidate.slug === item.slug ||
          candidate.legacyPublicSlug === item.slug
      );
      return cartProduct
        ? [{ product: cartProduct, quantity: item.quantity }]
        : [];
    });
    return cartRows.length
      ? cartRows
      : hasRequestedProduct && product
        ? [{ product, quantity }]
        : [];
  }, [items, products, product, quantity, hasRequestedProduct]);
  const [values, setValues] = useState<FormValues>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    region: "",
    city: "",
    postcode: "",
    locationKey: "",
    invoiceRequested: false,
    invoiceCompanyName: "",
    invoiceEik: "",
    invoiceVatNumber: "",
    invoiceMol: "",
    invoiceRegion: "",
    invoiceCity: "",
    invoiceLocationKey: "",
    invoicePostcode: "",
    invoiceAddress: "",
    invoiceAddressAdditional: "",
    invoiceAdditionalInfo: "",
    consent: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [regionQuery, setRegionQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [regionSuggestionsOpen, setRegionSuggestionsOpen] = useState(false);
  const [citySuggestionsOpen, setCitySuggestionsOpen] = useState(false);
  const [invoiceRegionQuery, setInvoiceRegionQuery] = useState("");
  const [invoiceCityQuery, setInvoiceCityQuery] = useState("");
  const [invoiceRegionSuggestionsOpen, setInvoiceRegionSuggestionsOpen] = useState(false);
  const [invoiceCitySuggestionsOpen, setInvoiceCitySuggestionsOpen] = useState(false);
  const [requestNumbers, setRequestNumbers] = useState<string[]>([]);
  const createOrderRequest = trpc.catalogue.createOrderRequest.useMutation({
    onError: () =>
      toast(
        language === "bg"
          ? "Заявката не можа да бъде записана. Опитайте отново."
          : "The request could not be saved. Please try again."
      ),
  });
  const total = checkoutRows.reduce(
    (sum, row) =>
      sum + (Number(row.product.price?.replace("€", "")) || 0) * row.quantity,
    0
  );
  const regions = useMemo(
    () =>
      Array.from(new Set(bulgarianLocations.map(location => location.region))),
    []
  );
  const locationOptions = useMemo(
    () =>
      bulgarianLocations.filter(location => location.region === values.region),
    [values.region]
  );
  const filteredRegions = useMemo(() => {
    const query = normalizeLocationQuery(regionQuery);
    return regions
      .filter(
        region => !query || normalizeLocationQuery(region).startsWith(query)
      );
  }, [regionQuery, regions]);
  const filteredInvoiceRegions = useMemo(() => {
    const query = normalizeLocationQuery(invoiceRegionQuery);
    return regions.filter(
      region => !query || normalizeLocationQuery(region).startsWith(query)
    );
  }, [invoiceRegionQuery, regions]);
  const filteredLocations = useMemo(() => {
    const query = normalizeLocationQuery(cityQuery);
    return locationOptions
      .filter(location => {
        const name = normalizeLocationQuery(location.name);
        const label = normalizeLocationQuery(locationLabel(location));
        return !query || name.startsWith(query) || label.startsWith(query);
      });
  }, [cityQuery, locationOptions]);
  const invoiceLocationOptions = useMemo(
    () =>
      bulgarianLocations.filter(
        location => location.region === values.invoiceRegion
      ),
    [values.invoiceRegion]
  );
  const filteredInvoiceLocations = useMemo(() => {
    const query = normalizeLocationQuery(invoiceCityQuery);
    return invoiceLocationOptions
      .filter(location => {
        const name = normalizeLocationQuery(location.name);
        const label = normalizeLocationQuery(locationLabel(location));
        return !query || name.startsWith(query) || label.startsWith(query);
      });
  }, [invoiceCityQuery, invoiceLocationOptions]);
  const flowTitle =
    language === "bg" ? "Заявка за доставка" : "Delivery request";
  const flowIntro =
    language === "bg"
      ? "Изпратете заявка за потвърждение. Екипът на Жоан ще провери наличността, цената и условията за доставка."
      : "Send a request for confirmation. The Joan team will verify availability, pricing, and delivery terms.";
  const consentLabel =
    language === "bg"
      ? "Разбирам, че това е заявка без онлайн плащане и екипът ще потвърди данните."
      : "I understand this is a request without online payment and the team will confirm the details.";

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
  }
  function updateRegion(region: string) {
    setRegionQuery(region);
    setRegionSuggestionsOpen(false);
    setCityQuery("");
    setValues(current => ({
      ...current,
      region,
      city: "",
      postcode: "",
      locationKey: "",
    }));
    setErrors(current => ({
      ...current,
      region: undefined,
      city: undefined,
      postcode: undefined,
    }));
  }
  function updateLocation(locationKey: string) {
    const location = locationOptions.find(
      candidate => `${candidate.name}::${candidate.postcode}` === locationKey
    );
    setValues(current => ({
      ...current,
      city: location?.name ?? "",
      postcode: location?.postcode ?? "",
      locationKey,
    }));
    setCityQuery(location ? locationLabel(location) : "");
    setCitySuggestionsOpen(false);
    setErrors(current => ({
      ...current,
      city: undefined,
      postcode: undefined,
    }));
  }
  function updateRegionQuery(query: string) {
    setRegionQuery(query);
    setRegionSuggestionsOpen(true);
    setValues(current => ({
      ...current,
      region: current.region === query ? current.region : "",
      city: "",
      postcode: "",
      locationKey: "",
    }));
    setCityQuery("");
    setErrors(current => ({
      ...current,
      region: undefined,
      city: undefined,
      postcode: undefined,
    }));
  }
  function updateCityQuery(query: string) {
    setCityQuery(query);
    setCitySuggestionsOpen(true);
    setValues(current => ({
      ...current,
      city: current.city === query ? current.city : "",
      postcode: current.city === query ? current.postcode : "",
      locationKey: current.city === query ? current.locationKey : "",
    }));
    setErrors(current => ({
      ...current,
      city: undefined,
      postcode: undefined,
    }));
  }
  function updateInvoiceRegion(region: string) {
    setInvoiceRegionQuery(region);
    setInvoiceRegionSuggestionsOpen(false);
    setInvoiceCityQuery("");
    setValues(current => ({
      ...current,
      invoiceRegion: region,
      invoiceCity: "",
      invoiceLocationKey: "",
      invoicePostcode: "",
    }));
    setErrors(current => ({
      ...current,
      invoiceRegion: undefined,
      invoiceCity: undefined,
      invoicePostcode: undefined,
    }));
  }
  function updateInvoiceLocation(locationKey: string) {
    const location = invoiceLocationOptions.find(
      candidate => `${candidate.name}::${candidate.postcode}` === locationKey
    );
    setValues(current => ({
      ...current,
      invoiceCity: location?.name ?? "",
      invoicePostcode: location?.postcode ?? "",
      invoiceLocationKey: locationKey,
    }));
    setInvoiceCityQuery(location ? locationLabel(location) : "");
    setInvoiceCitySuggestionsOpen(false);
    setErrors(current => ({
      ...current,
      invoiceCity: undefined,
      invoicePostcode: undefined,
    }));
  }
  function updateInvoiceRegionQuery(query: string) {
    setInvoiceRegionQuery(query);
    setInvoiceRegionSuggestionsOpen(true);
    setValues(current => ({
      ...current,
      invoiceRegion: current.invoiceRegion === query ? current.invoiceRegion : "",
      invoiceCity: "",
      invoiceLocationKey: "",
      invoicePostcode: "",
    }));
    setInvoiceCityQuery("");
    setErrors(current => ({
      ...current,
      invoiceRegion: undefined,
      invoiceCity: undefined,
      invoicePostcode: undefined,
    }));
  }
  function updateInvoiceCityQuery(query: string) {
    setInvoiceCityQuery(query);
    setInvoiceCitySuggestionsOpen(true);
    setValues(current => ({
      ...current,
      invoiceCity: current.invoiceCity === query ? current.invoiceCity : "",
      invoicePostcode: current.invoiceCity === query ? current.invoicePostcode : "",
      invoiceLocationKey: current.invoiceCity === query ? current.invoiceLocationKey : "",
    }));
    setErrors(current => ({
      ...current,
      invoiceCity: undefined,
      invoicePostcode: undefined,
    }));
  }
  function validate() {
    const next: FormErrors = {};
    if (values.fullName.trim().length < 3) next.fullName = t("validationName");
    if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = t("validationEmail");
    if ((values.phone.match(/\d/g) || []).length < 7)
      next.phone = t("validationPhone");
    if (values.address.trim().length < 6) next.address = t("validationAddress");
    if (!values.region)
      next.region = language === "bg" ? "Изберете област." : "Select a region.";
    if (values.city.trim().length < 2 || !values.locationKey)
      next.city = t("validationCity");
    if (!/^\d{4}$/.test(values.postcode))
      next.postcode = t("validationPostcode");
    if (values.invoiceRequested) {
      if (values.invoiceCompanyName.trim().length < 2)
        next.invoiceCompanyName = language === "bg" ? "Въведете име на фирмата." : "Enter the company name.";
      if (!/^(?:\d{9}|\d{13})$/.test(values.invoiceEik.trim()))
        next.invoiceEik = language === "bg" ? "ЕИК/БУЛСТАТ трябва да съдържа 9 или 13 цифри." : "EIK/BULSTAT must contain exactly 9 or 13 digits.";
      if (values.invoiceMol.trim().length < 2)
        next.invoiceMol = language === "bg" ? "Въведете МОЛ." : "Enter the authorized person.";
      if (!values.invoiceRegion)
        next.invoiceRegion = language === "bg" ? "Изберете област за фактурата." : "Select an invoice region.";
      if (values.invoiceCity.trim().length < 2 || !values.invoiceLocationKey)
        next.invoiceCity = language === "bg" ? "Въведете населено място." : "Enter a city or village.";
      if (!/^\d{4}$/.test(values.invoicePostcode))
        next.invoicePostcode = language === "bg" ? "Въведете 4-цифрен пощенски код." : "Enter a 4-digit postcode.";
      if (values.invoiceAddress.trim().length < 3)
        next.invoiceAddress = language === "bg" ? "Въведете адрес." : "Enter an address.";
    }
    if (!values.consent)
      next.consent =
        language === "bg"
          ? "Потвърдете, че заявката е без онлайн плащане."
          : "Confirm that this request has no online payment.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitError(null);
    try {
      const result = await createOrderRequest.mutateAsync({
        items: checkoutRows.map(row => ({
          productSlug: row.product.slug,
          quantity: row.quantity,
        })),
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        region: values.region.trim(),
        city: values.city.trim(),
        postcode: values.postcode.trim(),
        invoiceRequested: values.invoiceRequested,
        invoiceCompanyName: values.invoiceRequested ? values.invoiceCompanyName.trim() : null,
        invoiceEik: values.invoiceRequested ? values.invoiceEik.trim() : null,
        invoiceVatNumber: values.invoiceRequested ? values.invoiceVatNumber.trim() || null : null,
        invoiceMol: values.invoiceRequested ? values.invoiceMol.trim() : null,
        invoiceRegion: values.invoiceRequested ? values.invoiceRegion.trim() : null,
        invoiceCity: values.invoiceRequested ? values.invoiceCity.trim() : null,
        invoicePostcode: values.invoiceRequested ? values.invoicePostcode.trim() : null,
        invoiceAddress: values.invoiceRequested ? values.invoiceAddress.trim() : null,
        invoiceAddressAdditional: values.invoiceRequested ? values.invoiceAddressAdditional.trim() || null : null,
        invoiceAdditionalInfo: values.invoiceRequested ? values.invoiceAdditionalInfo.trim() || null : null,
      });
      setRequestNumbers([result.requestNumber]);
      clearCart();
    } catch {
      const message = language === "bg"
        ? "Заявката не можа да бъде записана. Проверете данните и опитайте отново."
        : "The request could not be saved. Check the details and try again.";
      setSubmitError(message);
      toast(message);
    }
  }

  return (
    <Layout>
      <PageMeta title={flowTitle} description={flowIntro} />
      <main className="checkout-page">
        <div className="page-frame checkout-frame">
          <div className="checkout-topline">
            <Link
              href={
                checkoutRows[0]
                  ? `/product/${checkoutRows[0].product.slug}`
                  : "/products"
              }
            >
              <ChevronLeft size={17} /> {t("backToProduct")}
            </Link>
            <span>
              <ShieldAlert size={16} /> {t("mockSecurity")}
            </span>
          </div>
          {requestNumbers.length ? (
            <section className="checkout-success">
              <CheckCircle2 size={46} />
              <p className="eyebrow">
                {language === "bg"
                  ? "Заявка за потвърждение"
                  : "Confirmation request"}
              </p>
              <h1>
                {language === "bg"
                  ? "Заявката е регистрирана."
                  : "Your request was recorded."}
              </h1>
              <p>
                {language === "bg"
                  ? `Номера ${requestNumbers.join(", ")}. Не е извършено онлайн плащане. Екипът на Жоан ще се свърже с Вас за потвърждение на наличност, цена и доставка.`
                  : `References ${requestNumbers.join(", ")}. No online payment was taken. The Joan team will contact you to confirm availability, price, and delivery.`}
              </p>
              <Link href="/category/instrumenti" className="button-solid">
                {t("continueShopping")} <ArrowRight size={18} />
              </Link>
            </section>
          ) : (
            <div className="checkout-grid">
              <section className="checkout-form-panel">
                <div className="checkout-panel-heading">
                  <p className="eyebrow">
                    {language === "bg"
                      ? "Заявка без плащане"
                      : "Request without payment"}
                  </p>
                  <h1>{flowTitle}</h1>
                  <p>{flowIntro}</p>
                </div>
                <form noValidate onSubmit={submit}>
                  <fieldset>
                    <legend>
                      <ClipboardCheck size={18} /> {t("customerDetails")}
                    </legend>
                    <label>
                      {t("fullName")}
                      <input
                        value={values.fullName}
                        onChange={event =>
                          update("fullName", event.target.value)
                        }
                        aria-invalid={Boolean(errors.fullName)}
                      />
                      {errors.fullName && (
                        <small className="field-error">{errors.fullName}</small>
                      )}
                    </label>
                    <div className="checkout-two-col">
                      <label>
                        {t("email")}
                        <input
                          type="email"
                          value={values.email}
                          onChange={event =>
                            update("email", event.target.value)
                          }
                          aria-invalid={Boolean(errors.email)}
                        />
                        {errors.email && (
                          <small className="field-error">{errors.email}</small>
                        )}
                      </label>
                      <label>
                        {t("phone")}
                        <input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={values.phone}
                          onChange={event =>
                            update(
                              "phone",
                              event.target.value.replace(/\D/g, "")
                            )
                          }
                          aria-invalid={Boolean(errors.phone)}
                        />
                        {errors.phone && (
                          <small className="field-error">{errors.phone}</small>
                        )}
                      </label>
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>
                      <PackageCheck size={18} /> {t("deliveryAddress")}
                    </legend>
                    <label>
                      {t("address")}
                      <input
                        value={values.address}
                        onChange={event =>
                          update("address", event.target.value)
                        }
                        aria-invalid={Boolean(errors.address)}
                      />
                      {errors.address && (
                        <small className="field-error">{errors.address}</small>
                      )}
                    </label>
                    <div className="checkout-two-col">
                      <label className="checkout-combobox">
                        {language === "bg" ? "Област" : "Region"}
                        <input
                          value={regionQuery}
                          onChange={event =>
                            updateRegionQuery(event.target.value)
                          }
                          onFocus={() => setRegionSuggestionsOpen(true)}
                          onBlur={() =>
                            setTimeout(
                              () => setRegionSuggestionsOpen(false),
                              120
                            )
                          }
                          placeholder={
                            language === "bg"
                              ? "Напишете област..."
                              : "Type a region..."
                          }
                          autoComplete="off"
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={regionSuggestionsOpen}
                          aria-controls="checkout-region-suggestions"
                          aria-invalid={Boolean(errors.region)}
                        />
                        {regionSuggestionsOpen &&
                          filteredRegions.length > 0 && (
                            <div
                              id="checkout-region-suggestions"
                              className="checkout-suggestions"
                              role="listbox"
                            >
                              {filteredRegions.map(region => (
                                <button
                                  key={region}
                                  type="button"
                                  role="option"
                                  onMouseDown={event => event.preventDefault()}
                                  onClick={() => updateRegion(region)}
                                >
                                  {region}
                                </button>
                              ))}
                            </div>
                          )}
                        {errors.region && (
                          <small className="field-error">{errors.region}</small>
                        )}
                      </label>
                      <label className="checkout-combobox">
                        {language === "bg" ? "Град/село" : "City/village"}
                        <input
                          value={cityQuery}
                          onChange={event =>
                            updateCityQuery(event.target.value)
                          }
                          onFocus={() =>
                            values.region && setCitySuggestionsOpen(true)
                          }
                          onBlur={() =>
                            setTimeout(() => setCitySuggestionsOpen(false), 120)
                          }
                          placeholder={
                            values.region
                              ? language === "bg"
                                ? "Напишете град или село..."
                                : "Type a city or village..."
                              : language === "bg"
                                ? "Първо изберете област"
                                : "Select a region first"
                          }
                          autoComplete="off"
                          disabled={!values.region}
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={citySuggestionsOpen}
                          aria-controls="checkout-city-suggestions"
                          aria-invalid={Boolean(errors.city)}
                        />
                        {citySuggestionsOpen &&
                          values.region &&
                          filteredLocations.length > 0 && (
                            <div
                              id="checkout-city-suggestions"
                              className="checkout-suggestions"
                              role="listbox"
                            >
                              {filteredLocations.map(location => (
                                <button
                                  key={`${location.name}-${location.postcode}`}
                                  type="button"
                                  role="option"
                                  onMouseDown={event => event.preventDefault()}
                                  onClick={() =>
                                    updateLocation(
                                      `${location.name}::${location.postcode}`
                                    )
                                  }
                                >
                                  {locationLabel(location)}
                                </button>
                              ))}
                            </div>
                          )}
                        {errors.city && (
                          <small className="field-error">{errors.city}</small>
                        )}
                      </label>
                    </div>
                    <label>
                      {t("postcode")}
                      <input
                        value={values.postcode}
                        onChange={event =>
                          update(
                            "postcode",
                            event.target.value.replace(/\D/g, "").slice(0, 4)
                          )
                        }
                        placeholder={
                          language === "bg"
                            ? "Въведете или редактирайте кода"
                            : "Enter or edit the postcode"
                        }
                        aria-invalid={Boolean(errors.postcode)}
                      />
                      {errors.postcode && (
                        <small className="field-error">{errors.postcode}</small>
                      )}
                    </label>
                  </fieldset>
                  <fieldset className="invoice-fieldset">
                    <legend>{language === "bg" ? "Данни за фактура" : "Invoice details"}</legend>
                    <div className="invoice-choice-group" role="radiogroup" aria-label={language === "bg" ? "Желаете ли фактура" : "Do you want an invoice"}>
                      <label className="invoice-choice">
                        <input
                          type="radio"
                          name="invoiceRequested"
                          checked={values.invoiceRequested}
                          onChange={() => update("invoiceRequested", true)}
                        />
                        <span>{language === "bg" ? "Желая фактура за фирма" : "I want a company invoice"}</span>
                      </label>
                      <label className="invoice-choice">
                        <input
                          type="radio"
                          name="invoiceRequested"
                          checked={!values.invoiceRequested}
                          onChange={() => {
                            update("invoiceRequested", false);
                            setErrors(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith("invoice"))) as FormErrors);
                          }}
                        />
                        <span>{language === "bg" ? "Не желая фактура" : "I do not want an invoice"}</span>
                      </label>
                    </div>
                    {values.invoiceRequested && (
                      <div className="invoice-fields">
                        <label>
                          {language === "bg" ? "Име на фирмата *" : "Company name *"}
                          <input value={values.invoiceCompanyName} onChange={event => update("invoiceCompanyName", event.target.value)} placeholder={language === "bg" ? "Име на фирмата" : "Company name"} aria-invalid={Boolean(errors.invoiceCompanyName)} />
                          {errors.invoiceCompanyName && <small className="field-error">{errors.invoiceCompanyName}</small>}
                        </label>
                        <div className="checkout-two-col">
                          <label>
                            {language === "bg" ? "ЕИК/БУЛСТАТ *" : "EIK/BULSTAT *"}
                            <input inputMode="numeric" maxLength={13} value={values.invoiceEik} onChange={event => update("invoiceEik", event.target.value.replace(/\D/g, "").slice(0, 13))} placeholder={language === "bg" ? "ЕИК/БУЛСТАТ" : "EIK/BULSTAT"} aria-invalid={Boolean(errors.invoiceEik)} />
                            {errors.invoiceEik && <small className="field-error">{errors.invoiceEik}</small>}
                          </label>
                          <label>
                            {language === "bg" ? "ИН по ЗДДС" : "VAT number"}
                            <input value={values.invoiceVatNumber} onChange={event => update("invoiceVatNumber", event.target.value)} placeholder={language === "bg" ? "ИН по ЗДДС" : "VAT number"} />
                          </label>
                        </div>
                        <label>
                          {language === "bg" ? "МОЛ *" : "Authorized person *"}
                          <input value={values.invoiceMol} onChange={event => update("invoiceMol", event.target.value)} placeholder={language === "bg" ? "МОЛ" : "Authorized person"} aria-invalid={Boolean(errors.invoiceMol)} />
                          {errors.invoiceMol && <small className="field-error">{errors.invoiceMol}</small>}
                        </label>
                        <div className="checkout-two-col">
                          <label className="checkout-combobox">
                            {language === "bg" ? "Област *" : "Region *"}
                            <input
                              value={invoiceRegionQuery}
                              onChange={event => updateInvoiceRegionQuery(event.target.value)}
                              onFocus={() => setInvoiceRegionSuggestionsOpen(true)}
                              onBlur={() => setTimeout(() => setInvoiceRegionSuggestionsOpen(false), 120)}
                              placeholder={language === "bg" ? "Напишете област..." : "Type a region..."}
                              autoComplete="off"
                              role="combobox"
                              aria-autocomplete="list"
                              aria-expanded={invoiceRegionSuggestionsOpen}
                              aria-controls="invoice-region-suggestions"
                              aria-invalid={Boolean(errors.invoiceRegion)}
                            />
                            {invoiceRegionSuggestionsOpen && filteredInvoiceRegions.length > 0 && (
                              <div id="invoice-region-suggestions" className="checkout-suggestions" role="listbox">
                                {filteredInvoiceRegions.map(region => (
                                  <button key={`invoice-${region}`} type="button" role="option" onMouseDown={event => event.preventDefault()} onClick={() => updateInvoiceRegion(region)}>
                                    {region}
                                  </button>
                                ))}
                              </div>
                            )}
                            {errors.invoiceRegion && <small className="field-error">{errors.invoiceRegion}</small>}
                          </label>
                          <label className="checkout-combobox">
                            {language === "bg" ? "Град/село *" : "City/village *"}
                            <input
                              value={invoiceCityQuery}
                              onChange={event => updateInvoiceCityQuery(event.target.value)}
                              onFocus={() => values.invoiceRegion && setInvoiceCitySuggestionsOpen(true)}
                              onBlur={() => setTimeout(() => setInvoiceCitySuggestionsOpen(false), 120)}
                              placeholder={values.invoiceRegion ? (language === "bg" ? "Напишете град или село..." : "Type a city or village...") : (language === "bg" ? "Първо изберете област" : "Select a region first")}
                              autoComplete="off"
                              disabled={!values.invoiceRegion}
                              role="combobox"
                              aria-autocomplete="list"
                              aria-expanded={invoiceCitySuggestionsOpen}
                              aria-controls="invoice-city-suggestions"
                              aria-invalid={Boolean(errors.invoiceCity)}
                            />
                            {invoiceCitySuggestionsOpen && values.invoiceRegion && filteredInvoiceLocations.length > 0 && (
                              <div id="invoice-city-suggestions" className="checkout-suggestions" role="listbox">
                                {filteredInvoiceLocations.map(location => (
                                  <button key={`invoice-${location.name}-${location.postcode}`} type="button" role="option" onMouseDown={event => event.preventDefault()} onClick={() => updateInvoiceLocation(`${location.name}::${location.postcode}`)}>
                                    {locationLabel(location)}
                                  </button>
                                ))}
                              </div>
                            )}
                            {errors.invoiceCity && <small className="field-error">{errors.invoiceCity}</small>}
                          </label>
                        </div>
                        <label>
                          {language === "bg" ? "Пощенски код *" : "Postcode *"}
                          <input inputMode="numeric" value={values.invoicePostcode} onChange={event => update("invoicePostcode", event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={language === "bg" ? "Въведете или редактирайте кода" : "Enter or edit the postcode"} aria-invalid={Boolean(errors.invoicePostcode)} />
                          {errors.invoicePostcode && <small className="field-error">{errors.invoicePostcode}</small>}
                        </label>
                        <label>
                          {language === "bg" ? "Адрес *" : "Address *"}
                          <input value={values.invoiceAddress} onChange={event => update("invoiceAddress", event.target.value)} placeholder={language === "bg" ? "Адрес" : "Address"} aria-invalid={Boolean(errors.invoiceAddress)} />
                          {errors.invoiceAddress && <small className="field-error">{errors.invoiceAddress}</small>}
                        </label>
                        <label>
                          {language === "bg" ? "Адрес допълнително" : "Additional address"}
                          <input value={values.invoiceAddressAdditional} onChange={event => update("invoiceAddressAdditional", event.target.value)} placeholder={language === "bg" ? "Адрес допълнително" : "Additional address"} />
                        </label>
                        <label>
                          {language === "bg" ? "Допълнителна информация" : "Additional information"}
                          <textarea value={values.invoiceAdditionalInfo} onChange={event => update("invoiceAdditionalInfo", event.target.value)} placeholder={language === "bg" ? "Допълнителна информация" : "Additional information"} rows={3} />
                        </label>
                      </div>
                    )}
                  </fieldset>
                  <label className="checkout-consent">
                    <input
                      type="checkbox"
                      checked={values.consent}
                      onChange={event =>
                        update("consent", event.target.checked)
                      }
                    />{" "}
                    <span>{consentLabel}</span>
                  </label>
                  {errors.consent && (
                    <small className="field-error consent-error">
                      {errors.consent}
                    </small>
                  )}
                  {submitError && (
                    <small className="field-error checkout-submit-error" role="alert">
                      {submitError}
                    </small>
                  )}
                  <button
                    type="submit"
                    className="button-solid checkout-submit"
                    disabled={
                      createOrderRequest.isPending || checkoutRows.length === 0
                    }
                  >
                    {createOrderRequest.isPending
                      ? language === "bg"
                        ? "Записване..."
                        : "Saving..."
                      : language === "bg"
                        ? "Изпрати заявката"
                        : "Send request"}{" "}
                    <ArrowRight size={18} />
                  </button>
                </form>
              </section>
              <aside className="checkout-summary">
                <p className="eyebrow">{t("orderSummary")}</p>
                {checkoutRows.length ? (
                  <>
                    <div className="checkout-cart-list">
                      {checkoutRows.map(row => (
                        <article
                          className="checkout-product"
                          key={row.product.slug}
                        >
                          <img
                            src={row.product.image}
                            alt={row.product.imageAlt}
                          />
                          <div>
                            <p className="product-brand">{row.product.brand}</p>
                            <h2>{row.product.name}</h2>
                            <b>{row.product.price ?? t("enquiry")}</b>
                            <div className="checkout-cart-controls">
                              <button
                                type="button"
                                onClick={() =>
                                  setQuantity(
                                    row.product.slug,
                                    row.quantity - 1
                                  )
                                }
                                aria-label={`${language === "bg" ? "Намали количеството на" : "Decrease quantity for"} ${row.product.name}`}
                              >
                                <Minus size={14} />
                              </button>
                              <span>{row.quantity}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setQuantity(
                                    row.product.slug,
                                    row.quantity + 1
                                  )
                                }
                                aria-label={`${language === "bg" ? "Увеличи количеството на" : "Increase quantity for"} ${row.product.name}`}
                              >
                                <Plus size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeItem(row.product.slug)}
                                aria-label={`${language === "bg" ? "Премахни" : "Remove"} ${row.product.name}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="checkout-total">
                      <span>{t("total")}</span>
                      <strong>
                        {total ? `${total.toFixed(2)}€` : t("enquiry")}
                      </strong>
                    </div>
                  </>
                ) : (
                  <div className="checkout-cart-empty">
                    <p>
                      {language === "bg"
                        ? "Количката е празна."
                        : "Your cart is empty."}
                    </p>
                    <Link href="/products">
                      {language === "bg"
                        ? "Разгледайте продуктите"
                        : "Browse products"}{" "}
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                )}
                <div className="checkout-disclosure">
                  <LockKeyhole size={19} />
                  <p>
                    <b>{flowTitle}</b>
                    {t("mockSecurity")}
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}
