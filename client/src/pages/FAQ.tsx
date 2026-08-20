/** DESIGN REMINDER — Red Workshop Modernism: a calm, question-first support page with compact red signals and direct handoff to the team. */
import { Layout, PageMeta } from "@/components/Storefront";
import { ArrowRight, ChevronDown, Mail, MessageCircleQuestion, Phone } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const faqItems = [
  ["Как започвам запитване за връщане?", "Свържете се с екипа чрез страницата „Връщане“ или „Контакти“. Подгответе име, телефон, имейл, номер и дата на поръчката, продукта, кода и количеството."],
  ["Какво е входящ номер за връщане (RMA)?", "Това е референтен номер за заявката, който помага на екипа да проследи конкретното връщане. Той се потвърждава след преглед на данните за поръчката и продукта."],
  ["Колко време имам за отказ от поръчка?", "Публикуваните условия на ЖОАН посочват 14 дни от получаването на стоката при приложимост. Вижте условията за изключенията и пълните детайли."],
  ["Мога ли да изпратя продукта веднага?", "Първо се свържете с екипа, за да получите указания за конкретния случай и за начина на предаване или изпращане."],
  ["Какво да направя при дефект или грешно изпратен продукт?", "Опишете случая и се свържете с екипа възможно най-скоро. Подгответе данните за продукта и поръчката, за да получите точни следващи стъпки."],
  ["Как мога да проверя наличност или срок за доставка?", "Изпратете запитване през контактната форма или се обадете на екипа. Наличността и срокът се потвърждават индивидуално за конкретния продукт и адрес."],
] as const;

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return <Layout><PageMeta title="Често задавани въпроси" description="Често задавани въпроси за връщане, наличности, доставка и контакт с ЖОАН." /><main className="faq-page">
    <section className="faq-hero"><div className="page-frame"><p className="eyebrow">Помощен център</p><h1>Често задавани въпроси</h1><p>Бързи отговори за връщане, наличност, доставка и следващи стъпки. За конкретна поръчка екипът на ЖОАН потвърждава приложимите условия.</p><div className="faq-hero-actions"><Link href="/returns" className="button-solid">Връщане на продукти <ArrowRight size={18} /></Link><Link href="/contact" className="button-outline-dark">Изпратете запитване <ArrowRight size={18} /></Link></div></div></section>
    <section className="page-frame faq-content" aria-labelledby="faq-list-title"><div className="faq-intro"><MessageCircleQuestion size={26} /><p className="eyebrow">Отговори</p><h2 id="faq-list-title">Информация преди да се свържете с нас.</h2><p>Страницата събира най-честите въпроси на едно място. Тя е информационна и не подава автоматично заявление или поръчка.</p></div><div className="faq-list">{faqItems.map(([question, answer], index) => { const isOpen = openIndex === index; const answerId = `faq-answer-${index}`; return <article key={question} className={`faq-item${isOpen ? " is-open" : ""}`}><button type="button" className="faq-question" aria-expanded={isOpen} aria-controls={answerId} onClick={() => setOpenIndex(isOpen ? null : index)}><span><em>{String(index + 1).padStart(2, "0")}</em>{question}</span><ChevronDown size={19} aria-hidden="true" /><span className="sr-only">{isOpen ? "Прибери отговора" : "Разгъни отговора"}</span></button><div id={answerId} className="faq-answer" aria-hidden={!isOpen}><div><p>{answer}</p></div></div></article>; })}</div></section>
    <section className="page-frame faq-contact-strip"><div><p className="eyebrow">Все още имате въпрос?</p><h2>Екипът на ЖОАН е насреща.</h2></div><div><a href="tel:+359884742770"><Phone size={18} /> (0884) 742 770</a><a href="mailto:info@joan.bg"><Mail size={18} /> info@joan.bg</a></div></section>
  </main></Layout>;
}
