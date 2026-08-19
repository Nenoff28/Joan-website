/** DESIGN REMINDER — Red Workshop Modernism: cinematic video entry, search-forward utility, material-led category discovery, and controlled Joan-red signals. */
import { CategoryIcon, JsonLd, Layout, PageMeta, ProductCard, SectionHeading, ServiceStrip } from "@/components/Storefront";
import { store } from "@/lib/storeData";
import { useCatalogue } from "@/hooks/useCatalogue";
import { ArrowRight, ChevronRight, ExternalLink, MapPin, PlayCircle, Search, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const liveCatalogueRoutes = [
  { label: "Инструменти", detail: "Електроинструменти, ръчни инструменти и консумативи", href: "https://joan.bg/%D1%81%D1%82%D1%80%D0%BE%D0%B8%D1%82%D0%B5%D0%BB%D0%BD%D0%B8-%D0%BC%D0%B0%D1%82%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%D0%B8/instrumenti" },
  { label: "Градина", detail: "Градинска техника, инструменти и принадлежности", href: "https://joan.bg/%D1%81%D1%82%D1%80%D0%BE%D0%B8%D1%82%D0%B5%D0%BB%D0%BD%D0%B8-%D0%BC%D0%B0%D1%82%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%D0%B8/dom-i-gradina" },
  { label: "Строителство", detail: "Материали, строителна химия и сухи смеси", href: "https://joan.bg/%D1%81%D1%82%D1%80%D0%BE%D0%B8%D1%82%D0%B5%D0%BB%D0%BD%D0%B8-%D0%BC%D0%B0%D1%82%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%D0%B8/stroitelstvo" },
  { label: "Промоции", detail: "Актуалните предложения в поддържания магазин", href: "https://joan.bg/special" },
];

export default function Home() {
  const { categories, products } = useCatalogue();
  function scrollToLiveCatalogue(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const target = document.getElementById("live-catalogue");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
  return <Layout>
    <PageMeta title="Строителен хипермаркет" description="Жоан: строителни материали, инструменти, продукти за дома и градината в Силистра." />
    <JsonLd />
    <main>
      <section className="hero-video">
        <video className="hero-video-media" autoPlay muted loop playsInline preload="metadata" aria-label="Видео от Строителен хипермаркет Жоан"><source src="/manus-storage/joan-hero_0c2a067a.mp4" type="video/mp4" /></video>
        <div className="hero-video-overlay" />
        <div className="page-frame hero-content"><div className="hero-kicker"><span /> Строителен хипермаркет Жоан</div><h1>Всичко за ремонта,<br /><em>на едно място.</em></h1><p>Открийте материали, инструменти и решения за дома, градината и професионалната работа.</p><div className="hero-actions"><a href="#live-catalogue" className="button-solid" onClick={scrollToLiveCatalogue} aria-controls="live-catalogue">Разгледайте каталога <ArrowRight size={18} /></a><Link href="/contact" className="button-outline-light"><MapPin size={18} /> Посетете магазина</Link></div></div><div className="hero-bottom-note"><div><PlayCircle size={18} /><span>ЖОАН В ДВИЖЕНИЕ<br /><b>Силистра · ул. Тутракан №22</b></span></div><a href="#live-catalogue" onClick={scrollToLiveCatalogue}>Изберете категория <ChevronRight size={17} /></a></div>
      </section>
      <ServiceStrip />
      <section id="live-catalogue" className="live-catalogue-bridge" aria-labelledby="live-catalogue-title">
        <div className="page-frame"><div className="live-catalogue-heading"><div><p className="eyebrow">Актуален каталог</p><h2 id="live-catalogue-title">Разгледайте реалните артикули в Жоан.</h2><p>Изберете категория, за да отворите поддържания каталог на Joan.bg с текущи продукти, наличности и предложения.</p></div><a href="https://joan.bg" target="_blank" rel="noreferrer" className="live-store-link">Отвори Joan.bg <ExternalLink size={17} /></a></div><div className="live-catalogue-grid">{liveCatalogueRoutes.map((route, index) => <a key={route.label} href={route.href} target="_blank" rel="noreferrer" className="live-catalogue-card"><span>0{index + 1}</span><div><h3>{route.label}</h3><p>{route.detail}</p></div><ExternalLink size={19} /></a>)}</div><p className="live-catalogue-note">Тук се използват връзки към поддържания магазин на Жоан. При предоставен официален API или CSV/XML export, тази секция може да показва текущи продукти директно в сайта.</p></div>
      </section>
      <section id="categories" className="page-frame category-section"><SectionHeading eyebrow="Започнете оттук" title="Категории за всяка задача" text="Подредете ремонта по етапи, материал или инструмент — без излишно търсене." action={<Link className="section-action" href="/category/instrumenti">Всички категории <ArrowRight size={17} /></Link>} /><div className="feature-category-grid all-category-grid">{categories.map((category) => <Link key={category.slug} href={`/category/${category.slug}`} className="feature-category-card"><img src={category.image} alt="" loading="lazy" /><div className="feature-card-scrim" /><div><span className="feature-icon"><CategoryIcon icon={category.icon} size={20} /></span><p>{category.label}</p><small>{category.description}</small></div><ArrowRight className="feature-arrow" size={19} /></Link>)}</div></section>
      <section id="promotions" className="promotions-section"><div className="page-frame"><SectionHeading eyebrow="Топ промоции" title="Акценти от текущите предложения" text="Тестови продукти и цени за проверка на маршрутите в каталога. За реална наличност — изпратете запитване." action={<Link className="section-action" href="/category/instrumenti">Виж продукти <ArrowRight size={17} /></Link>} /><div className="product-grid homepage-products">{products.filter((product) => product.discount).slice(0, 4).map((product) => <ProductCard key={product.slug} product={product} />)}</div></div></section>
      <section className="project-bay"><div className="page-frame project-bay-grid"><div className="project-bay-copy"><p className="eyebrow">Работилница за идеи</p><h2>Планирате ремонт?</h2><p>Започнете от категорията, която отговаря на задачата ви. От строителни материали до ВиК и защитно облекло — информацията остава близо до продукта.</p><div className="project-search"><Search size={19} /><span>Търсете по продукт, категория или марка</span><Link href="/category/instrumenti" aria-label="Към продуктовото търсене"><ArrowRight size={18} /></Link></div></div><div className="project-links"><Link href="/category/stroitelstvo"><b>Строителство</b><span>Материали и химия</span><ArrowRight size={17} /></Link><Link href="/category/boi-lakove-mazilki"><b>Бои и мазилки</b><span>Подготовка и завършек</span><ArrowRight size={17} /></Link><Link href="/category/v-i-k"><b>В и К</b><span>Части и аксесоари</span><ArrowRight size={17} /></Link></div></div></section>
      <section className="page-frame company-split"><div className="company-red-block"><p className="eyebrow">Жоан от 2001 г.</p><h2>Изградено около работата, която трябва да бъде свършена.</h2><p>Фирма Жоан започва като търговец на метали и разширява дейността си към строителни материали, професионални и хоби инструменти, техника, електроматериали, ВиК и продукти за дома.</p><Link href="/about">Научете повече за Жоан <ArrowRight size={18} /></Link></div><div className="company-facts"><div><strong>7 200 м²</strong><span>закрита площ в собствени бази</span></div><div><strong>22 800 м²</strong><span>дворно място</span></div><div><strong>20 000+</strong><span>артикула, поддържани на склад</span></div><div className="company-location"><MapPin size={19} /><span><b>{store.city}</b>{store.address}</span></div></div></section>
      <section className="page-frame final-service-card"><ShieldCheck size={32} /><div><p className="eyebrow">Преди да поръчате</p><h2>Нужна ви е точна информация?</h2><p>За наличност, доставка и технически данни по конкретен продукт, свържете се директно с екипа на Жоан.</p></div><Link href="/contact" className="button-solid">Контакти <ArrowRight size={18} /></Link></section>
    </main>
  </Layout>;
}
