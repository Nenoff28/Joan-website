/** DESIGN REMINDER — Red Workshop Modernism: company scale is expressed through substantiated facts, quiet editorial layouts, and material depth—not invented claims. */
import { JsonLd, Layout, PageMeta, SectionHeading } from "@/components/Storefront";
import { ArrowRight, Building2, Layers3, PackageCheck, UsersRound } from "lucide-react";
import { Link } from "wouter";

export default function About() {
  return <Layout>
    <PageMeta title="За Жоан" description="Историята на фирма Жоан, основана през 2001 г., и нейните категории за строителство, дом и градина." />
    <JsonLd />
    <main>
      <section className="about-hero"><div className="page-frame about-hero-inner"><div><p className="eyebrow">За фирма Жоан</p><h1>От метали до всичко необходимо за ремонта.</h1><p>Жоан е основана през 2001 г. като фирма за търговия с метали и разширява дейността си към материали, инструменти, дом и градина.</p><Link href="/contact" className="button-solid">Посетете магазина <ArrowRight size={18} /></Link></div><div className="about-hero-figure"><span>От</span><strong>2001</strong><small>Силистра, България</small></div></div></section>
      <section className="page-frame about-story"><div className="about-intro"><p className="eyebrow">Развитие с практична цел</p><h2>Подбор, логистика и компетентно обслужване.</h2><p>Според публикуваната информация на Жоан, фирмата разширява асортимента, клиентите и екипа си от първоначалните 50 позиции и четирима души. Днес дейността обхваща метали, строителни материали, професионални и хоби инструменти, защитни средства, градинска техника, строителна химия, електроматериали, ВиК, крепежи и продукти за дома.</p></div><div className="about-steps"><div><span>01</span><p><b>Широк асортимент</b>Подбран спрямо търсенето и нуждите на клиентите.</p></div><div><span>02</span><p><b>Работа в синхрон</b>Координирани звена и логистика за по-бързо обслужване.</p></div><div><span>03</span><p><b>Коректно партньорство</b>Точност, уважение и лоялност към клиенти и доставчици.</p></div></div></section>
      <section className="fact-band"><div className="page-frame fact-grid"><div><Building2 /><strong>7 200 м²</strong><span>закрита площ в собствени бази</span></div><div><Layers3 /><strong>22 800 м²</strong><span>дворно място</span></div><div><UsersRound /><strong>300+</strong><span>фирми от града и областта</span></div><div><PackageCheck /><strong>20 000+</strong><span>артикула, поддържани на склад</span></div></div></section>
      <section className="page-frame about-bottom"><SectionHeading eyebrow="Жоан днес" title="Практичен партньор за дом, ремонт и работа." text="Целта на Жоан е клиентите да се ориентират по-лесно сред голямото продуктово разнообразие и да получават компетентно обслужване според публикуваната информация на компанията." /><div className="about-bottom-links"><Link href="/category/instrumenti">Разгледайте категориите <ArrowRight size={17} /></Link><Link href="/delivery">Условия за доставка <ArrowRight size={17} /></Link><Link href="/contact">Контакти и работно време <ArrowRight size={17} /></Link></div></section>
    </main>
  </Layout>;
}
