import {
  CategoryIcon,
  JsonLd,
  Layout,
  PageMeta,
  ProductCard,
  SectionHeading,
} from "@/components/Storefront";
import { useCatalogue, useCataloguePage } from "@/hooks/useCatalogue";
import { categoryPathTokens } from "@/lib/categoryHierarchy";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Maximize2,
  Minimize2,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

const fallbackBrochurePages = [
  "/manus-storage/page-1_7884f6f6.jpg",
  "/manus-storage/page-2_9b25fc80.jpg",
  "/manus-storage/page-3_6c0ba892.jpg",
  "/manus-storage/page-4_b096aaa9.jpg",
  "/manus-storage/page-5_a794f27b.jpg",
  "/manus-storage/page-6_be1779c9.jpg",
  "/manus-storage/page-7_4cdd94c0.jpg",
  "/manus-storage/page-8_d10987e1.jpg",
];

const homepageCategoryPath = (slug: string, labels: string[] = []) => {
  const path = categoryPathTokens(labels).join("~");
  return `/category/${slug}${path ? `?path=${path}` : ""}`;
};

export default function Home() {
  const { language } = useLanguage();
  const en = language === "en";
  const { categories } = useCatalogue();
  const featuredProducts = useCataloguePage({
    page: 1,
    pageSize: 12,
    sort: "relevance",
  });
  const bestSellersQuery = trpc.catalogue.bestSellers.useQuery({ language });
  const brochureQuery = trpc.catalogue.brochure.useQuery();
  const [activePromoBanner, setActivePromoBanner] = useState(0);
  const [openCategorySlug, setOpenCategorySlug] = useState<string | null>(null);
  const promoBanners = [
    {
      id: "ideal-standard-1",
      image: "/manus-storage/ideal-standard-promo_907d970b.jpg",
      alt: "Ideal Standard Amazi II Rimless+ конзолна тоалетна чиния на промоция",
      eyebrow: en ? "Bathroom offer · slide 1" : "Оферта за баня · слайд 1",
      title: "Ideal Standard Amazi II Rimless+",
      price: "159 €",
      oldPrice: "177 €",
      href: "/product/legacy-2432-record",
    },
    {
      id: "ideal-standard-2",
      image: "/manus-storage/ideal-standard-promo_907d970b.jpg",
      alt: "Ideal Standard Amazi II Rimless+ конзолна тоалетна чиния на промоция",
      eyebrow: en ? "Bathroom offer · slide 2" : "Оферта за баня · слайд 2",
      title: "Ideal Standard Amazi II Rimless+",
      price: "159 €",
      oldPrice: "177 €",
      href: "/product/legacy-2432-record",
    },
    {
      id: "ideal-standard-3",
      image: "/manus-storage/ideal-standard-promo_907d970b.jpg",
      alt: "Ideal Standard Amazi II Rimless+ конзолна тоалетна чиния на промоция",
      eyebrow: en ? "Bathroom offer · slide 3" : "Оферта за баня · слайд 3",
      title: "Ideal Standard Amazi II Rimless+",
      price: "159 €",
      oldPrice: "177 €",
      href: "/product/legacy-2432-record",
    },
    {
      id: "ideal-standard-4",
      image: "/manus-storage/ideal-standard-promo_907d970b.jpg",
      alt: "Ideal Standard Amazi II Rimless+ конзолна тоалетна чиния на промоция",
      eyebrow: en ? "Bathroom offer · slide 4" : "Оферта за баня · слайд 4",
      title: "Ideal Standard Amazi II Rimless+",
      price: "159 €",
      oldPrice: "177 €",
      href: "/product/legacy-2432-record",
    },
  ];
  useEffect(() => {
    const timer = window.setInterval(
      () =>
        setActivePromoBanner(current => (current + 1) % promoBanners.length),
      7000
    );
    return () => window.clearInterval(timer);
  }, [promoBanners.length]);
  const brochurePages = brochureQuery.data?.pageUrls?.length
    ? brochureQuery.data.pageUrls
    : fallbackBrochurePages;
  const brochureTitle =
    brochureQuery.data?.title ??
    (en ? "Promotional brochure" : "Промо брошура");
  const [activeBrochurePage, setActiveBrochurePage] = useState(0);
  const [brochureRotationEpoch, setBrochureRotationEpoch] = useState(0);
  const [brochureFullscreen, setBrochureFullscreen] = useState(false);
  const brochureViewerRef = useRef<HTMLDivElement>(null);
  const fullscreenTriggerRef = useRef<HTMLButtonElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const previousBrochurePage =
    brochurePages[
      (activeBrochurePage - 1 + brochurePages.length) % brochurePages.length
    ];
  const nextBrochurePage =
    brochurePages[(activeBrochurePage + 1) % brochurePages.length];
  const scrollToBrochure = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    document.getElementById("brochure")?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };
  const setBrochurePage = (nextPage: number) => {
    setActiveBrochurePage(
      (nextPage + brochurePages.length) % brochurePages.length
    );
    setBrochureRotationEpoch(epoch => epoch + 1);
  };
  const openBrochureFullscreen = () => {
    brochureViewerRef.current?.requestFullscreen?.().catch(() => undefined);
  };
  const closeBrochureFullscreen = () => {
    if (document.fullscreenElement)
      document.exitFullscreen?.().catch(() => undefined);
  };
  const handleBrochureTouchStart = (
    event: React.TouchEvent<HTMLDivElement>
  ) => {
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };
  const handleBrochureTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const horizontalDistance = touch.clientX - start.x;
    const verticalDistance = touch.clientY - start.y;
    if (
      Math.abs(horizontalDistance) < 48 ||
      Math.abs(horizontalDistance) < Math.abs(verticalDistance)
    )
      return;
    setBrochurePage(activeBrochurePage + (horizontalDistance < 0 ? 1 : -1));
  };
  const handleBrochureKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setBrochurePage(activeBrochurePage - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setBrochurePage(activeBrochurePage + 1);
    }
    if (event.key === "Escape" && brochureFullscreen) closeBrochureFullscreen();
  };
  useEffect(() => {
    if (activeBrochurePage >= brochurePages.length) setActiveBrochurePage(0);
  }, [activeBrochurePage, brochurePages.length]);
  /* ), 7000) */
  useEffect(() => {
    const timer = window.setInterval(
      () => setActiveBrochurePage(page => (page + 1) % brochurePages.length),
      7000
    );
    return () => window.clearInterval(timer);
  }, [brochurePages.length, brochureRotationEpoch]);
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = document.fullscreenElement === brochureViewerRef.current;
      setBrochureFullscreen(active);
      if (!active)
        window.setTimeout(() => fullscreenTriggerRef.current?.focus(), 0);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);
  /* href="/products">{en ? "All products" : "Всички продукти"} */
  /* <h1>{en ? "Building materials" : "Строителни материали"}</h1> */
  /* Browse<br />offers */
  /* Разгледайте<br />офертите */
  return (
    <Layout>
      <PageMeta
        title={en ? "Building materials" : "Строителни материали"}
        description={
          en
            ? "Joan in Silistra: building materials, home and garden products. Find everything for renovation in one place."
            : "ЖОАН в Силистра: строителни материали, продукти за дома и градината. Открийте всичко за ремонта на едно място."
        }
      />
      <JsonLd />
      <main>
        <section
          className="homepage-entrance page-frame"
          aria-label={
            en
              ? "Categories and promotional offers"
              : "Категории и промоционални предложения"
          }
        >
          <aside
            className="homepage-category-menu"
            aria-label={en ? "Product categories" : "Категории продукти"} style={{backgroundColor: '#d23a32'}}
          >
            <div className="homepage-category-menu-title">
              <span>{en ? "Categories" : "Категории"}</span>
              <b>{String(categories.length).padStart(2, "0")}</b>
            </div>
            <nav>
              {categories.map(category => (
                <div className="homepage-category-item" key={category.slug}>
                  <button
                    type="button"
                    className={`homepage-category-link homepage-category-trigger ${openCategorySlug === category.slug ? "is-open" : ""}`}
                    onClick={() =>
                      setOpenCategorySlug(current =>
                        current === category.slug ? null : category.slug
                      )
                    }
                    aria-expanded={openCategorySlug === category.slug}
                    aria-controls={`homepage-category-flyout-${category.slug}`}
                  >
                    <CategoryIcon icon={category.icon} size={18} />
                    <span>{category.label}</span>
                    <ArrowRight size={14} />
                  </button>
                  <div
                    id={`homepage-category-flyout-${category.slug}`}
                    className="homepage-category-flyout"
                    role="menu"
                    aria-label={`${category.label} — ${en ? "subcategories" : "подкатегории"}`}
                    hidden={openCategorySlug !== category.slug}
                  >
                    <strong>{category.label}</strong>
                    <Link
                      href={homepageCategoryPath(category.slug)}
                      className="homepage-category-flyout-all"
                      role="menuitem"
                      onClick={() => setOpenCategorySlug(null)}
                    >
                      {en ? "All in" : "Всички в"} {category.label}{" "}
                      <ArrowRight size={14} />
                    </Link>
                    <div className="homepage-category-flyout-grid">
                      {category.subcategories.map(group => (
                        <div
                          key={group.label}
                          className="homepage-category-flyout-group"
                        >
                          <Link
                            href={homepageCategoryPath(category.slug, [
                              group.label,
                            ])}
                            role="menuitem"
                            onClick={() => setOpenCategorySlug(null)}
                          >
                            {group.label}
                          </Link>
                          {group.children?.slice(0, 6).map(child => (
                            <Link
                              key={child.label}
                              href={homepageCategoryPath(category.slug, [
                                group.label,
                                child.label,
                              ])}
                              role="menuitem"
                              onClick={() => setOpenCategorySlug(null)}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </nav>
          </aside>
          <div
            className="homepage-banner-stage"
            aria-roledescription="carousel"
            aria-label={en ? "Promotional offers" : "Промоционални предложения"}
          >
            <Link
              key={promoBanners[activePromoBanner].id}
              href={promoBanners[activePromoBanner].href}
              className="homepage-banner-link homepage-banner-slide-in"
              aria-label={promoBanners[activePromoBanner].alt}
            >
              <img
                src={promoBanners[activePromoBanner].image}
                alt={promoBanners[activePromoBanner].alt}
              />
            </Link>
            <div
              className="homepage-banner-dots"
              role="tablist"
              aria-label={en ? "Promotional slides" : "Промоционални слайдове"}
            >
              {promoBanners.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  className={index === activePromoBanner ? "is-active" : ""}
                  onClick={() => setActivePromoBanner(index)}
                  role="tab"
                  aria-selected={index === activePromoBanner}
                  aria-label={
                    en
                      ? `Open offer ${index + 1}`
                      : `Отвори оферта ${index + 1}`
                  }
                />
              ))}
            </div>
          </div>
          <div
            className="homepage-entrance-actions"
            aria-label={
              en ? "Homepage shortcuts" : "Бързи връзки от началната страница"
            }
          >
            <a
              href="#brochure"
              className="homepage-entrance-cta homepage-entrance-cta-primary"
              onClick={scrollToBrochure}
            >
              <FileText size={18} />
              <span>{en ? "Browse brochure" : "Разгледайте брошурата"}</span>
              <ArrowRight size={16} />
            </a>
            <a
              href="#current-offers"
              className="homepage-entrance-cta homepage-entrance-cta-secondary"
            >
              <span>
                {en ? "Promotional products" : "Продукти на промоция"}
              </span>
              <ArrowRight size={16} />
            </a>
          </div>
        </section>
        <section
          id="current-offers"
          className="promotions-section homepage-product-shelf"
          aria-labelledby="current-offers-title"
        >
          <div className="page-frame">
            <SectionHeading
              eyebrow={en ? "Joan catalogue" : "Каталог Жоан"}
              title={en ? "Current offers" : "Актуални предложения"}
              text={
                en
                  ? "12 recently updated real products from the current catalogue."
                  : "12 последно обновени реални артикула от текущия каталог."
              }
              action={
                <Link className="section-action" href="/products">
                  {en ? "View all products" : "Виж всички продукти"}{" "}
                  <ArrowRight size={17} />
                </Link>
              }
            />
            <div className="product-grid homepage-products">
              {featuredProducts.products.slice(0, 12).map(product => (
                <ProductCard key={product.slug} product={product} />
              ))}
            </div>
          </div>
        </section>
        <section
          className="homepage-best-sellers"
          aria-labelledby="best-sellers-title"
        >
          <div className="page-frame">
            <SectionHeading
              eyebrow={en ? "Historical data" : "Исторически данни"}
              title={en ? "Best sellers" : "Най-продавани"}
              text={
                en
                  ? "8 products with the highest total quantity in migrated historical orders."
                  : "8 продукта с най-голямо общо количество в мигрираните исторически поръчки."
              }
              action={
                <Link className="section-action" href="/products">
                  {en ? "Browse catalogue" : "Разгледайте каталога"}{" "}
                  <ArrowRight size={17} />
                </Link>
              }
            />
            <div className="product-grid homepage-products">
              {(bestSellersQuery.data ?? []).slice(0, 8).map(product => (
                <ProductCard key={product.slug} product={product} />
              ))}
            </div>
          </div>
        </section>
        <section
          id="brochure"
          className="brochure-section"
          aria-labelledby="brochure-title"
        >
          <div className="page-frame">
            <div className="brochure-heading">
              <div>
                <p className="eyebrow">
                  {en ? "New brochure" : "Нова брошура"}
                </p>
                <h2 id="brochure-title">
                  {en
                    ? "Browse the offers in the monthly brochure."
                    : "Разгледайте офертите от месечната брошура."}
                </h2>
                <p>
                  {en
                    ? "Focus on the current page, with a print-edition feel and a discreet view of the next offers."
                    : "Фокус върху текущата страница, с усещане за печатно издание и дискретен поглед към следващите оферти."}
                </p>
              </div>
              <div className="brochure-heading-meta">
                <FileText size={21} />
                <span>
                  <b>{brochureTitle}</b>
                  {brochurePages.length}{" "}
                  {en
                    ? "pages · managed in the administration panel"
                    : "страници · управлява се от администраторския панел"}
                </span>
              </div>
            </div>
            <div className="brochure-viewer-shell" ref={brochureViewerRef}>
              <div className="brochure-workbench brochure-3d-workbench">
                <div className="brochure-index">
                  <span>{en ? "BROCHURE" : "БРОШУРА"}</span>
                  <b>{String(activeBrochurePage + 1).padStart(2, "0")}</b>
                  <small>
                    / {String(brochurePages.length).padStart(2, "0")}
                  </small>
                  <i />
                  <p>
                    {en ? (
                      <>
                        Browse
                        <br />
                        offers
                      </>
                    ) : (
                      <>
                        Разгледайте
                        <br />
                        офертите
                      </>
                    )}
                  </p>
                </div>
                <div
                  className="brochure-3d-stage"
                  tabIndex={0}
                  onTouchStart={handleBrochureTouchStart}
                  onTouchEnd={handleBrochureTouchEnd}
                  onKeyDown={handleBrochureKeyDown}
                  aria-roledescription="carousel"
                  aria-label={`${brochureTitle}. ${en ? "Swipe left or right on a mobile device." : "Плъзнете наляво или надясно на мобилно устройство."}`}
                >
                  <button
                    type="button"
                    className="brochure-page-preview brochure-page-preview-left"
                    onClick={() => setBrochurePage(activeBrochurePage - 1)}
                    aria-label={en ? "Previous page" : "Предишна страница"}
                  >
                    <img
                      src={previousBrochurePage}
                      alt={`${brochureTitle} — ${en ? "previous page" : "предишна страница"}`}
                    />
                    <span>
                      <ChevronLeft size={17} /> {en ? "Previous" : "Предишна"}
                    </span>
                  </button>
                  <article
                    className="brochure-active-page"
                    key={brochurePages[activeBrochurePage]}
                  >
                    <div className="brochure-page-frame">
                      <img
                        src={brochurePages[activeBrochurePage]}
                        alt={`${brochureTitle} — ${en ? `page ${activeBrochurePage + 1} of ${brochurePages.length}` : `страница ${activeBrochurePage + 1} от ${brochurePages.length}`}`}
                      />
                      <span className="brochure-page-gloss" />
                    </div>
                    <div className="brochure-active-caption" aria-live="polite">
                      <span>
                        {en ? "PG." : "СТР."}{" "}
                        {String(activeBrochurePage + 1).padStart(2, "0")}
                      </span>
                      <b>{brochureTitle}</b>
                      <small>
                        {activeBrochurePage + 1} / {brochurePages.length}
                      </small>
                    </div>
                  </article>
                  <button
                    type="button"
                    className="brochure-page-preview brochure-page-preview-right"
                    onClick={() => setBrochurePage(activeBrochurePage + 1)}
                    aria-label={en ? "Next page" : "Следваща страница"}
                  >
                    <img
                      src={nextBrochurePage}
                      alt={`${brochureTitle} — ${en ? "next page" : "следваща страница"}`}
                    />
                    <span>
                      {en ? "Next" : "Следваща"} <ChevronRight size={17} />
                    </span>
                  </button>
                  <div className="brochure-stage-tools">
                    <button
                      type="button"
                      onClick={() => setBrochurePage(activeBrochurePage - 1)}
                      aria-label={
                        en
                          ? "Previous brochure page"
                          : "Предишна страница от брошурата"
                      }
                    >
                      <ChevronLeft size={21} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBrochurePage(activeBrochurePage + 1)}
                      aria-label={
                        en
                          ? "Next brochure page"
                          : "Следваща страница от брошурата"
                      }
                    >
                      <ChevronRight size={21} />
                    </button>
                    <button
                      type="button"
                      className="brochure-fullscreen-trigger"
                      ref={fullscreenTriggerRef}
                      onClick={
                        brochureFullscreen
                          ? closeBrochureFullscreen
                          : openBrochureFullscreen
                      }
                      aria-label={
                        brochureFullscreen
                          ? en
                            ? "Exit full screen"
                            : "Излез от цял екран"
                          : en
                            ? "Open brochure full screen"
                            : "Отвори брошурата на цял екран"
                      }
                    >
                      {brochureFullscreen ? (
                        <Minimize2 size={18} />
                      ) : (
                        <Maximize2 size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="brochure-compact-nav">
                <span>{en ? "Choose a page" : "Изберете страница"}</span>
                <div
                  role="tablist"
                  aria-label={en ? "Brochure pages" : "Страници на брошурата"}
                >
                  {brochurePages.map((page, index) => (
                    <button
                      key={page}
                      type="button"
                      className={
                        index === activeBrochurePage ? "is-active" : ""
                      }
                      onClick={() => setBrochurePage(index)}
                      role="tab"
                      aria-selected={index === activeBrochurePage}
                      aria-label={
                        en
                          ? `Open page ${index + 1}`
                          : `Отвори страница ${index + 1}`
                      }
                    >
                      {String(index + 1).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="categories" className="page-frame category-section">
          <SectionHeading
            eyebrow={en ? "Start here" : "Започнете оттук"}
            title={
              en ? "Categories for every task" : "Категории за всяка задача"
            }
            text={
              en
                ? "Organise your renovation by stage, material or tool — without needless searching."
                : "Подредете ремонта по етапи, материал или инструмент — без излишно търсене."
            }
            action={
              <Link className="section-action" href="/products">
                {en ? "All products" : "Всички продукти"}{" "}
                <ArrowRight size={17} />
              </Link>
            }
          />
          <div className="feature-category-grid all-category-grid">
            {categories.map(category => (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                className="feature-category-card"
              >
                <img
                  src={category.image}
                  alt={`${category.label} — ${category.description}`}
                  loading="lazy"
                />
                <div className="feature-card-scrim" />
                <div>
                  <span className="feature-icon">
                    <CategoryIcon icon={category.icon} size={20} />
                  </span>
                  <div className="feature-category-copy">
                    <p>{category.label}</p>
                    <small>{category.description}</small>
                  </div>
                </div>
                <ArrowRight className="feature-arrow" size={19} />
              </Link>
            ))}
          </div>
        </section>
        <section className="page-frame final-service-card">
          <ShieldCheck size={32} />
          <div>
            <p className="eyebrow">
              {en ? "Before you order" : "Преди да поръчате"}
            </p>
            <h2>
              {en
                ? "Do you need accurate information?"
                : "Нужна ви е точна информация?"}
            </h2>
            <p>
              {en
                ? "For availability, delivery and technical information about a specific product, contact the Joan team directly."
                : "За наличност, доставка и технически данни по конкретен продукт, свържете се директно с екипа на Жоан."}
            </p>
          </div>
          <Link href="/contact" className="button-solid">
            {en ? "Contact" : "Контакти"} <ArrowRight size={18} />
          </Link>
        </section>
      </main>
    </Layout>
  );
}
