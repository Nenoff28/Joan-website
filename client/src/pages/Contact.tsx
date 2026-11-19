/** Contact enquiry page with complete Bulgarian and English customer-facing copy. */
import { JsonLd, Layout, PageMeta } from "@/components/Storefront";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { store } from "@/lib/storeData";
import { storeStatus } from "@/lib/storeStatus";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Send,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

const subjects = {
  bg: [
    "Информация за продукт",
    "Информация за сервизно обслужване",
    "Информация за доставки",
    "Друго",
  ],
  en: [
    "Product information",
    "Service information",
    "Delivery information",
    "Other",
  ],
};

// Computed after mount so server and client markup agree.
function useStoreStatus() {
  const [status, setStatus] = useState<{ open: boolean; today: number } | null>(null);
  useEffect(() => {
    setStatus(storeStatus(store.hours, new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Sofia" }))));
  }, []);
  return status;
}

export default function Contact() {
  const { language } = useLanguage();
  const en = language === "en";
  const [reference, setReference] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const status = useStoreStatus();
  const enquiry = trpc.contact.createEnquiry.useMutation({
    onSuccess: result => {
      setReference(result.referenceNumber);
      toast.success(
        en
          ? `Your enquiry was sent. Reference: ${result.referenceNumber}`
          : `Запитването е изпратено. Номер: ${result.referenceNumber}`
      );
    },
    onError: error =>
      toast.error(
        error.message ||
          (en
            ? "Your enquiry could not be sent. Please try again."
            : "Запитването не можа да бъде изпратено. Опитайте отново.")
      ),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReference(null);
    setFormError(null);
    // currentTarget is null once the event has finished, so keep the element for the async success callback.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const fullName = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const subject = String(form.get("subject") ?? "").trim();
    const message = String(form.get("message") ?? "").trim();
    if (!fullName || !email || !subject || !message) {
      setFormError(
        en ? "The form has not been completed." : "Не е попълнен формулярът."
      );
      return;
    }
    if (phone && !/^\+?[0-9]+$/.test(phone)) {
      setFormError(
        en
          ? "The phone number may contain only digits and +."
          : "Телефонът може да съдържа само цифри и знак +."
      );
      return;
    }
    enquiry.mutate(
      { fullName, email, phone: phone.trim() || null, subject, message },
      {
        onSuccess: () => {
          formElement.reset();
          setPhone("");
        },
      }
    );
  }
  return (
    <Layout>
      <PageMeta
        title={en ? "Contact" : "Контакти"}
        description={
          en
            ? "Contact details, address and opening hours for Joan in Silistra."
            : "Контакти, адрес и работно време на Жоан в Силистра."
        }
      />
      <JsonLd />
      <main className="contact-page">
        <section className="page-frame contact-heading">
          <h1>
            {en
              ? "Let’s find the right solution."
              : "Нека намерим точното решение."}
          </h1>
          <p>
            {en
              ? "Contact the Joan team for product, service or delivery information."
              : "Свържете се с екипа на Жоан за информация за продукт, сервизно обслужване или доставка."}
          </p>
        </section>
        <section className="page-frame contact-grid">
          <aside className="contact-details">
            <div className="contact-card-main">
              <div className="contact-address">
                <MapPin size={22} aria-hidden="true" />
                <div>
                  <b>{en ? "Joan store" : "Магазин Жоан"}</b>
                  <h2>{en ? "Silistra, 22 Tutrakan St." : store.address}</h2>
                </div>
                <a
                  className="contact-map-link"
                  href="https://maps.app.goo.gl/fJW7QuQC9hL4jtqQ8"
                  target="_blank"
                  rel="noreferrer"
                >
                  {en ? "Directions" : "Упътване"} <ExternalLink size={15} />
                </a>
              </div>
            </div>
            <div className="contact-data contact-phones">
              <Phone size={20} />
              <div>
                <b>{en ? "Call us" : "Обадете ни се"}</b>
                {store.phones.map(phone => (
                  <a key={phone} href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>
                    {phone}
                  </a>
                ))}
              </div>
            </div>
            <div className="contact-data">
              <Mail size={20} />
              <div>
                <b>{en ? "Write to us" : "Пишете ни"}</b>
                <a href={`mailto:${store.email}`}>{store.email}</a>
                <small>{en ? "We reply on working days." : "Отговаряме в работни дни."}</small>
              </div>
            </div>
            <div className="contact-data opening-hours">
              <Clock3 size={20} />
              <div>
                <b>
                  {en ? "Store opening hours" : "Работно време на магазина"}
                  {status && <em className={status.open ? "is-open" : "is-closed"}>{status.open ? (en ? "Open now" : "Отворено сега") : en ? "Closed now" : "Затворено"}</em>}
                </b>
                {store.hours.map(([day, hour], index) => (
                  <p key={day} className={status?.today === index ? "is-today" : undefined}>
                    <span>
                      {en
                        ? day
                            .replace("Понеделник", "Monday")
                            .replace("Вторник", "Tuesday")
                            .replace("Сряда", "Wednesday")
                            .replace("Четвъртък", "Thursday")
                            .replace("Петък", "Friday")
                            .replace("Събота", "Saturday")
                            .replace("Неделя", "Sunday")
                        : day}
                    </span>
                    <span>{hour}</span>
                  </p>
                ))}
              </div>
            </div>
          </aside>
          <form className="contact-form" onSubmit={submit} noValidate>
            <div>
              <h2>{en ? "How can we help?" : "Как можем да помогнем?"}</h2>
              <p>
                {en
                  ? "Complete the details and the Joan team will receive your enquiry directly."
                  : "Попълнете детайлите и екипът на Жоан ще получи запитването ви директно."}
              </p>
            </div>
            <div className="form-two-col">
              <label>
                {en ? "Your name" : "Вашето име"}
                <input
                  required
                  minLength={3}
                  name="name"
                  placeholder={en ? "Full name" : "Име и фамилия"}
                  disabled={enquiry.isPending}
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  name="email"
                  placeholder="email@example.com"
                  disabled={enquiry.isPending}
                />
              </label>
            </div>
            <div className="form-two-col">
              <label>
                {en ? "Phone" : "Телефон"}
                <input
                  type="tel"
                  inputMode="tel"
                  pattern="\\+?[0-9]+"
                  minLength={7}
                  name="phone"
                  value={phone}
                  onChange={event =>
                    setPhone(
                      event.target.value
                        .replace(/[^0-9+]/g, "")
                        .replace(/(?!^)\+/g, "")
                    )
                  }
                  placeholder={en ? "Contact phone" : "Телефон за връзка"}
                  disabled={enquiry.isPending}
                />
              </label>
              <label>
                {en ? "Subject" : "Тема"}
                <select
                  required
                  name="subject"
                  defaultValue=""
                  disabled={enquiry.isPending}
                >
                  <option value="" disabled>
                    {en ? "Choose a subject" : "Изберете тема"}
                  </option>
                  {subjects[language].map(subject => (
                    <option key={subject}>{subject}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              {en ? "Your message" : "Вашето съобщение"}
              <textarea
                required
                minLength={10}
                maxLength={5000}
                name="message"
                rows={6}
                placeholder={
                  en
                    ? "Enter a product, code or question..."
                    : "Напишете продукт, код или въпрос..."
                }
                disabled={enquiry.isPending}
              />
            </label>
            <button
              type="submit"
              className="button-solid"
              disabled={enquiry.isPending}
              aria-busy={enquiry.isPending}
              aria-describedby="contact-submission-feedback"
            >
              {enquiry.isPending ? (
                <>
                  <Loader2 size={18} className="contact-submit-spinner" />{" "}
                  {en ? "Sending enquiry…" : "Изпращаме запитването…"}
                </>
              ) : (
                <>
                  {en ? "Send enquiry" : "Изпратете запитване"}{" "}
                  <Send size={18} />
                </>
              )}
            </button>
            <div
              id="contact-submission-feedback"
              className="contact-submit-feedback"
              aria-live="polite"
            >
              {formError && (
                <p className="contact-form-error" role="alert">
                  {formError}
                </p>
              )}
              {enquiry.isPending && (
                <p className="contact-submitting" role="status">
                  <Loader2 size={18} className="contact-submit-spinner" />{" "}
                  {en
                    ? "Sending your enquiry to the Joan team…"
                    : "Изпращаме запитването ви към екипа на ЖОАН…"}
                </p>
              )}
              {reference && (
                <div className="contact-success" role="status" tabIndex={-1}>
                  <CheckCircle2 size={20} />
                  <div>
                    <b>
                      {en
                        ? "Your enquiry was sent successfully."
                        : "Запитването е изпратено успешно."}
                    </b>
                    <span>
                      {en ? (
                        <>
                          Your reference is <strong>{reference}</strong>. The
                          team will contact you.
                        </>
                      ) : (
                        <>
                          Вашият номер е <strong>{reference}</strong>. Екипът ще
                          се свърже с вас.
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <small>
              {en
                ? "Submitted data is stored only to process your enquiry. No payment data is collected."
                : "Изпратените данни се пазят единствено за обработване на запитването. Не се събират платежни данни."}
            </small>
          </form>
        </section>
      </main>
    </Layout>
  );
}
