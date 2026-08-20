/** DESIGN REMINDER — Red Workshop Modernism: make real store details the strongest visual path, with a precise accessible form and red only for the send action. */
import { JsonLd, Layout, PageMeta } from "@/components/Storefront";
import { trpc } from "@/lib/trpc";
import { store } from "@/lib/storeData";
import { CheckCircle2, Clock3, ExternalLink, Loader2, Mail, MapPin, Phone, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const subjects = ["Информация за продукт", "Информация за сервизно обслужване", "Информация за доставки", "Друго"];

export default function Contact() {
  const [reference, setReference] = useState<string | null>(null);
  const enquiry = trpc.contact.createEnquiry.useMutation({
    onSuccess: (result, _input, _context) => { setReference(result.referenceNumber); toast.success(`Запитването е изпратено. Номер: ${result.referenceNumber}`); },
    onError: (error) => toast.error(error.message || "Запитването не можа да бъде изпратено. Опитайте отново."),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    enquiry.mutate({ fullName: String(form.get("name") ?? "").trim(), email: String(form.get("email") ?? "").trim(), phone: String(form.get("phone") ?? "").trim() || null, subject: String(form.get("subject") ?? "").trim(), message: String(form.get("message") ?? "").trim() }, { onSuccess: () => event.currentTarget.reset() });
  }
  return <Layout>
    <PageMeta title="Контакти" description="Контакти, адрес и работно време на Жоан в Силистра." />
    <JsonLd />
    <main className="contact-page"><section className="page-frame contact-heading"><p className="eyebrow">Контакти</p><h1>Нека намерим точното решение.</h1><p>Свържете се с екипа на Жоан за информация за продукт, сервизно обслужване или доставка.</p></section><section className="page-frame contact-grid"><aside className="contact-details"><div className="contact-card-main"><MapPin size={24} /><p className="eyebrow">Магазин Жоан</p><h2>{store.address}</h2><p>България</p><a href="https://maps.app.goo.gl/fJW7QuQC9hL4jtqQ8" target="_blank" rel="noreferrer">Отворете картата <ExternalLink size={16} /></a></div><div className="contact-data"><Phone size={20} /><div><b>Обадете ни се</b>{store.phones.map((phone) => <a key={phone} href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>{phone}</a>)}</div></div><div className="contact-data"><Mail size={20} /><div><b>Пишете ни</b><a href={`mailto:${store.email}`}>{store.email}</a></div></div><div className="contact-data opening-hours"><Clock3 size={20} /><div><b>Работно време на магазина</b>{store.hours.map(([day, hour]) => <p key={day}><span>{day}</span><span>{hour}</span></p>)}</div></div></aside><form className="contact-form" onSubmit={submit} noValidate><div><p className="eyebrow">Изпратете запитване</p><h2>Как можем да помогнем?</h2><p>Попълнете детайлите и екипът на Жоан ще получи запитването ви директно в административната опашка.</p></div><div className="form-two-col"><label>Вашето име<input required minLength={3} name="name" placeholder="Име и фамилия" disabled={enquiry.isPending} /></label><label>Email<input required type="email" name="email" placeholder="email@primer.bg" disabled={enquiry.isPending} /></label></div><div className="form-two-col"><label>Телефон<input type="tel" minLength={7} name="phone" placeholder="Телефон за връзка" disabled={enquiry.isPending} /></label><label>Тема<select required name="subject" defaultValue="" disabled={enquiry.isPending}><option value="" disabled>Изберете тема</option>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label></div><label>Вашето съобщение<textarea required minLength={10} maxLength={5000} name="message" rows={6} placeholder="Напишете продукт, код или въпрос..." disabled={enquiry.isPending} /></label><button type="submit" className="button-solid" disabled={enquiry.isPending}>{enquiry.isPending ? <><Loader2 size={18} className="animate-spin" /> Изпращане...</> : <>Изпратете запитване <Send size={18} /></>}</button>{reference && <p className="contact-success" role="status"><CheckCircle2 size={18} /> Запитването е прието с номер <b>{reference}</b>. Екипът ще се свърже с вас.</p>}<small>Изпратените данни се пазят единствено за обработване на запитването. Не се събират платежни данни.</small></form></section></main>
  </Layout>;
}
