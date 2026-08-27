/** Company story with complete Bulgarian and English customer-facing copy. */
import { JsonLd, Layout, PageMeta, SectionHeading } from "@/components/Storefront";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowRight, Building2, Layers3, PackageCheck, UsersRound } from "lucide-react";
import { Link } from "wouter";
import "./aboutVideoHero.css";

export default function About() {
  const { language } = useLanguage();
  const en = language === "en";
  const heroKicker = en ? "Joan building hypermarket" : "Строителен хипермаркет Жоан";
  const heroTitle = en ? "Building materials" : "Строителни материали";
  const heroText = en ? "Everything for renovation, home, garden and professional work in one place." : "Всичко за ремонта, дома, градината и професионалната работа на едно място.";

  return <Layout><PageMeta title={en ? "About Joan" : "За Жоан"} description={en ? "The story of Joan, founded in 2001, and its building, home and garden categories." : "Историята на фирма Жоан, основана през 2001 г., и нейните категории за строителство, дом и градина."} /><JsonLd /><main>
    <section className="about-video" data-layout="about-video-top">
      <video className="about-video-media" autoPlay muted loop playsInline preload="metadata" aria-label={en ? "Video from Joan building hypermarket" : "Видео от Строителен хипермаркет Жоан"}>
        <source src="/manus-storage/joan-hero_0c2a067a.mp4" type="video/mp4" />
      </video>
      <div className="about-video-overlay" />
      <div className="page-frame about-video-copy about-video-home-copy">
        <div className="hero-kicker"><span /> {heroKicker}</div>
        <h1>{heroTitle}</h1>
        <p>{heroText}</p>
      </div>
    </section>

    <section className="page-frame about-story"><div className="about-intro"><p className="eyebrow">{en ? "Growth with a practical purpose" : "Развитие с практична цел"}</p><h2>{en ? "Selection, logistics and capable service." : "Подбор, логистика и компетентно обслужване."}</h2><p>{en ? "According to Joan’s published information, the company expanded its assortment, clients and team from its original 50 positions and four people. Today its activity covers metals, building materials, professional and DIY tools, protective equipment, garden machinery, construction chemicals, electrical materials, plumbing, fasteners and home products." : "Според публикуваната информация на Жоан, фирмата разширява асортимента, клиентите и екипа си от първоначалните 50 позиции и четирима души. Днес дейността обхваща метали, строителни материали, професионални и хоби инструменти, защитни средства, градинска техника, строителна химия, електроматериали, ВиК, крепежи и продукти за дома."}</p></div><div className="about-steps"><div><span>01</span><p><b>{en ? "Wide assortment" : "Широк асортимент"}</b>{en ? "Selected for customer demand and needs." : "Подбран спрямо търсенето и нуждите на клиентите."}</p></div><div><span>02</span><p><b>{en ? "Work in sync" : "Работа в синхрон"}</b>{en ? "Coordinated teams and logistics for faster service." : "Координирани звена и логистика за по-бързо обслужване."}</p></div><div><span>03</span><p><b>{en ? "Fair partnership" : "Коректно партньорство"}</b>{en ? "Accuracy, respect and loyalty to customers and suppliers." : "Точност, уважение и лоялност към клиенти и доставчици."}</p></div></div></section>

    <section className="page-frame original-about-photo"><div className="original-about-copy"><p className="eyebrow">{en ? "Inside the store" : "Магазинът отвътре"}</p><h2>{en ? "A place for materials, equipment and real work." : "Място за материали, техника и реална работа."}</h2><p>{en ? "A photograph of Joan’s store and its Silistra base." : "Кадър от магазина и базата на Жоан в Силистра."}</p><span>{en ? "JOAN · SILISTRA" : "ЖОАН · СИЛИСТРА"}</span></div><figure><img src="/manus-storage/joan-original-about_26666781.jpg" alt={en ? "Joan store in Silistra" : "Магазинът на Жоан в Силистра"} /><figcaption>{en ? "Joan store in Silistra." : "Магазинът на Жоан в Силистра."}</figcaption></figure></section>

    <section className="fact-band"><div className="page-frame fact-grid"><div><Building2 /><strong>7 200 m²</strong><span>{en ? "indoor area in company-owned facilities" : "закрита площ в собствени бази"}</span></div><div><Layers3 /><strong>22 800 m²</strong><span>{en ? "outdoor yard area" : "дворно място"}</span></div><div><UsersRound /><strong>300+</strong><span>{en ? "companies in the city and region" : "фирми от града и областта"}</span></div><div><PackageCheck /><strong>20 000+</strong><span>{en ? "items maintained in stock" : "артикула, поддържани на склад"}</span></div></div></section>

    <section className="about-hero"><div className="page-frame about-hero-inner"><div><p className="eyebrow">{en ? "About Joan" : "За фирма Жоан"}</p><h2>{en ? "From metals to everything needed for renovation." : "От метали до всичко необходимо за ремонта."}</h2><p>{en ? "Joan was founded in 2001 as a metal-trading company and expanded into materials, tools, home and garden." : "Жоан е основана през 2001 г. като фирма за търговия с метали и разширява дейността си към материали, инструменти, дом и градина."}</p><Link href="/contact" className="button-solid">{en ? "Visit the store" : "Посетете магазина"} <ArrowRight size={18} /></Link></div><div className="about-hero-figure"><span>{en ? "Since" : "От"}</span><strong>2001</strong><small>{en ? "Silistra, Bulgaria" : "Силистра, България"}</small></div></div></section>

    <section className="page-frame about-bottom"><SectionHeading eyebrow={en ? "Joan today" : "Жоан днес"} title={en ? "A practical partner for home, renovation and work." : "Практичен партньор за дом, ремонт и работа."} text={en ? "Joan aims to help customers navigate a wide product range more easily and receive knowledgeable service, according to the company’s published information." : "Целта на Жоан е клиентите да се ориентират по-лесно сред голямото продуктово разнообразие и да получават компетентно обслужване според публикуваната информация на компанията."} /><div className="about-bottom-links"><Link href="/category/instrumenti">{en ? "Browse categories" : "Разгледайте категориите"} <ArrowRight size={17} /></Link><Link href="/delivery">{en ? "Delivery terms" : "Условия за доставка"} <ArrowRight size={17} /></Link><Link href="/contact">{en ? "Contact and opening hours" : "Контакти и работно време"} <ArrowRight size={17} /></Link></div></section>
  </main></Layout>;
}
