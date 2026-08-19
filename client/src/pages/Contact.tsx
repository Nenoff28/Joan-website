/** DESIGN REMINDER — Red Workshop Modernism: make real store details the strongest visual path, with a precise accessible form and red only for the send action. */
import { JsonLd, Layout, PageMeta } from "@/components/Storefront";
import { store } from "@/lib/storeData";
import { Clock3, ExternalLink, Mail, MapPin, Phone, Send } from "lucide-react";
import { FormEvent } from "react";
import { toast } from "sonner";

export default function Contact() {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    toast("Формата е готова за интеграция. В този статичен проект съобщението не се изпраща.");
    event.currentTarget.reset();
  }
  return <Layout>
    <PageMeta title="Контакти" description="Контакти, адрес и работно време на Жоан в Силистра." />
    <JsonLd />
    <main className="contact-page"><section className="page-frame contact-heading"><p className="eyebrow">Контакти</p><h1>Нека намерим точното решение.</h1><p>Свържете се с екипа на Жоан за информация за продукт, сервизно обслужване или доставка.</p></section><section className="page-frame contact-grid"><aside className="contact-details"><div className="contact-card-main"><MapPin size={24} /><p className="eyebrow">Магазин Жоан</p><h2>{store.address}</h2><p>България</p><a href="https://www.google.com/maps/search/?api=1&query=%D0%B3%D1%80.%20%D0%A1%D0%B8%D0%BB%D0%B8%D1%81%D1%82%D1%80%D0%B0%2C%20%D1%83%D0%BB.%20%D0%A2%D1%83%D1%82%D1%80%D0%B0%D0%BA%D0%B0%D0%BD%20%E2%84%9622" target="_blank" rel="noreferrer">Отворете картата <ExternalLink size={16} /></a></div><div className="contact-data"><Phone size={20} /><div><b>Обадете ни се</b>{store.phones.map((phone) => <a key={phone} href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>{phone}</a>)}</div></div><div className="contact-data"><Mail size={20} /><div><b>Пишете ни</b><a href={`mailto:${store.email}`}>{store.email}</a></div></div><div className="contact-data opening-hours"><Clock3 size={20} /><div><b>Работно време на магазина</b>{store.hours.map(([day, hour]) => <p key={day}><span>{day}</span><span>{hour}</span></p>)}</div></div></aside><form className="contact-form" onSubmit={submit}><div><p className="eyebrow">Изпратете запитване</p><h2>Как можем да помогнем?</h2><p>Попълнете детайлите и екипът на Жоан ще се свърже с вас.</p></div><div className="form-two-col"><label>Вашето име<input required name="name" placeholder="Име и фамилия" /></label><label>Email<input required type="email" name="email" placeholder="email@primer.bg" /></label></div><div className="form-two-col"><label>Телефон<input type="tel" name="phone" placeholder="Телефон за връзка" /></label><label>Тема<select required name="subject" defaultValue=""><option value="" disabled>Изберете тема</option><option>Информация за продукт</option><option>Информация за сервизно обслужване</option><option>Информация за доставки</option><option>Друго</option></select></label></div><label>Вашето съобщение<textarea required name="message" rows={6} placeholder="Напишете продукт, код или въпрос..." /></label><button type="submit" className="button-solid">Изпратете запитване <Send size={18} /></button><small>В този прототип формата не изпраща данни. За активиране е нужно защитено свързване към система за обработка на запитвания.</small></form></section></main>
  </Layout>;
}
