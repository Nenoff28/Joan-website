import { FileText, Mail, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Layout, PageMeta } from "@/components/Storefront";
import { useLanguage } from "@/contexts/LanguageContext";
import "./privacyPage.css";

const sections = [
  {
    id: "controller",
    bg: { title: "Администратор на данните", body: "Администратор на данните е ЖОАН — строителен хипермаркет в Силистра. За въпроси относно личните данни можете да пишете на info@joan.bg или да използвате формата за контакт." },
    en: { title: "Data controller", body: "The data controller is JOAN — building hypermarket in Silistra. For questions about personal data, write to info@joan.bg or use the contact form." },
  },
  {
    id: "data",
    bg: { title: "Какви данни обработваме", body: "При контактно запитване обработваме името, имейл адреса, телефона, текста на запитването и техническия референтен номер на заявката. При вход чрез защитения профил обработваме предоставените от доставчика на удостоверяване име, имейл и идентификатор на профила. При клиентски профил може да се обработват адресни и поръчкови данни, когато са предоставени за тази цел." },
    en: { title: "Data we process", body: "For a contact enquiry, we process your name, email address, phone number, enquiry text and the request reference number. For secure account sign-in, we process the name, email and account identifier supplied by the authentication provider. Customer profiles may also contain address and order data when provided for that purpose." },
  },
  {
    id: "purposes",
    bg: { title: "Цели и правно основание", body: "Използваме данните за отговор на запитвания, обслужване на клиентски профили, обработка на заявки и поръчки, сигурност на системата и изпълнение на законови задължения. Не събираме картови номера или CVV данни в този сайт. Незадължителната статистика се активира само след съгласие чрез cookie banner-а." },
    en: { title: "Purposes and legal basis", body: "We use data to answer enquiries, operate customer accounts, process requests and orders, secure the system and meet legal obligations. This site does not collect card numbers or CVV data. Optional analytics is enabled only after consent through the cookie banner." },
  },
  {
    id: "storage",
    bg: { title: "Съхранение и получатели", body: "Данните се съхраняват в защитената инфраструктура на приложението и са достъпни само за хората и доставчиците, които са нужни за обслужването на сайта. Запитванията се съхраняват в административната опашка, за да може екипът да отговори. Не продаваме лични данни и не ги използваме за несвързани цели." },
    en: { title: "Storage and recipients", body: "Data is stored in the application’s protected infrastructure and is accessible only to people and providers needed to operate the site. Enquiries are retained in the administrator queue so the team can respond. We do not sell personal data or use it for unrelated purposes." },
  },
  {
    id: "rights",
    bg: { title: "Вашите права", body: "Имате право да поискате достъп, корекция, изтриване, ограничаване на обработването, преносимост или възражение, когато това е приложимо. Можете да оттеглите съгласието си за незадължителна статистика от настройките на браузъра или чрез изчистване на предпочитанието в cookie banner-а. Имате право и да подадете жалба до Комисията за защита на личните данни." },
    en: { title: "Your rights", body: "You may request access, correction, deletion, restriction, portability or objection where applicable. You can withdraw consent for optional analytics through your browser settings or by clearing the cookie preference in the banner. You may also lodge a complaint with the Bulgarian Commission for Personal Data Protection." },
  },
  {
    id: "cookies",
    bg: { title: "Бисквитки и локално съхранение", body: "Сайтът използва технически необходими session cookies за удостоверяване и може да използва localStorage за предпочитания като език, любими и количка. Незадължителният Umami analytics скрипт се зарежда само след изрично приемане. Не използваме рекламни tracking cookies." },
    en: { title: "Cookies and local storage", body: "The site uses strictly necessary session cookies for authentication and may use localStorage for preferences such as language, favourites and cart. The optional Umami analytics script loads only after explicit acceptance. We do not use advertising tracking cookies." },
  },
];

export default function Privacy() {
  const { language } = useLanguage();
  const en = language === "en";
  return <Layout><PageMeta title={en ? "Privacy Policy" : "Политика за поверителност"} description={en ? "Joan’s privacy policy: what data we process, why we process it and what rights you have." : "Политика за поверителност на ЖОАН: какви данни обработваме, защо и какви права имате."} /><main className="privacy-page"><section className="privacy-hero"><div className="page-frame"><p className="eyebrow">{en ? "Privacy and data protection" : "Поверителност и защита на данните"}</p><h1>{en ? "Your data, handled clearly." : "Вашите данни — обяснени ясно."}</h1><p>{en ? "This page explains the personal data used by the current Joan website and the choices available to you." : "Тази страница обяснява какви лични данни използва актуалният сайт на ЖОАН и какви избори имате."}</p></div></section><section className="page-frame privacy-layout"><aside className="privacy-index" aria-label={en ? "Privacy policy contents" : "Съдържание на политиката"}><p className="eyebrow">{en ? "Contents" : "Съдържание"}</p>{sections.map((section, index) => <a key={section.id} href={`#${section.id}`}>{String(index + 1).padStart(2, "0")} {(en ? section.en : section.bg).title}</a>)}</aside><div className="privacy-content"><div className="privacy-notice"><ShieldCheck size={22} aria-hidden="true" /><p>{en ? "We collect only information needed for the service you choose. Optional analytics is off until you decide otherwise." : "Събираме само информацията, нужна за избраната от вас услуга. Незадължителната статистика е изключена, докато не направите избор."}</p></div>{sections.map((section, index) => { const copy = en ? section.en : section.bg; return <article className="privacy-section" id={section.id} key={section.id}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{copy.title}</h2><p>{copy.body}</p></div></article>; })}<div className="privacy-final"><FileText size={22} aria-hidden="true" /><div><h2>{en ? "Need a specific answer?" : "Нуждаете се от конкретен отговор?"}</h2><p>{en ? "Contact us if you want to exercise a privacy right or ask about a specific request." : "Свържете се с нас, ако искате да упражните право или имате въпрос за конкретно запитване."}</p><Link href="/contact" className="button-solid"><Mail size={17} aria-hidden="true" />{en ? "Contact Joan" : "Свържете се с ЖОАН"}</Link></div></div><p className="privacy-updated">{en ? "Last reviewed: 1 September 2026." : "Последен преглед: 1 септември 2026 г."}</p></div></section></main></Layout>;
}
