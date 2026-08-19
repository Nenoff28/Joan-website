/**
 * DESIGN REMINDER — Red Workshop Modernism: dense, direct commerce hierarchy;
 * Joan Signal Red denotes action and selection only; neutral mineral surfaces keep products primary.
 */
import { Button } from "@/components/ui/button";
import { categories, products, store, type Product } from "@/lib/storeData";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  Bath,
  BrickWall,
  ChevronDown,
  ChevronRight,
  Clock3,
  Drill,
  Facebook,
  HardHat,
  Heart,
  House,
  LampDesk,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  PackageCheck,
  PanelsTopLeft,
  PaintRoller,
  Phone,
  Search,
  ShoppingCart,
  Trees,
  Truck,
  UserRound,
  Waves,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const categoryIcons = {
  drill: Drill,
  trees: Trees,
  house: House,
  bath: Bath,
  lamp: LampDesk,
  "panels-top-left": PanelsTopLeft,
  waves: Waves,
  "lock-keyhole": LockKeyhole,
  "paint-roller": PaintRoller,
  "brick-wall": BrickWall,
  "hard-hat": HardHat,
};

function usePageTitle(title: string, description: string) {
  useEffect(() => {
    document.title = `${title} | ЖОАН`;
    let descriptionTag = document.querySelector('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.setAttribute("name", "description");
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.setAttribute("content", description);
  }, [title, description]);
}

export function PageMeta({ title, description }: { title: string; description: string }) {
  usePageTitle(title, description);
  return null;
}

function Wordmark() {
  const { t } = useLanguage();
  return (
    <Link href="/" className="brand-mark" aria-label={`ЖОАН — ${t("home")}`}>
      <img src="/manus-storage/joan-symbol_8ab1677a.png" alt="" className="brand-symbol" />
      <span className="brand-word">ЖОАН</span>
      <span className="brand-subword">строителен хипермаркет</span>
    </Link>
  );
}

function Header() {
  const { language, setLanguage, t } = useLanguage();
  const [location, setLocation] = useLocation();
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchMatches = useMemo(
    () =>
      products.filter((product) => `${product.brand} ${product.name}`.toLowerCase().includes(query.toLowerCase())).slice(0, 4),
    [query],
  );

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (searchMatches[0]) {
      setLocation(`/product/${searchMatches[0].slug}`);
      setQuery("");
      setSearchFocused(false);
      return;
    }
    setLocation("/category/instrumenti");
    setSearchFocused(false);
    toast(t("noMatches"));
  }

  function doAction(action: string) {
    toast(`${action} — ${t("mockSecurity")}`);
  }

  return (
    <header className="site-header">
      <div className="utility-rail">
        <div className="page-frame utility-inner">
          <p><Truck size={14} /> {language === "bg" ? "Експресна доставка след потвърждение от оператор" : "Express delivery after operator confirmation"}</p>
          <div className="utility-actions">
            <Link href="/delivery">{t("delivery")}</Link>
            <Link href="/contact">{t("contacts")}</Link>
            <a href={`tel:${store.phones[2].replace(/[^0-9+]/g, "")}`}><Phone size={13} /> {store.phones[2]}</a>
          </div>
        </div>
      </div>

      <div className="page-frame masthead">
        <Wordmark />
        <form className="search-wrap" onSubmit={submitSearch} role="search">
          <label htmlFor="site-search" className="sr-only">{t("searchLabel")}</label>
          <Search size={20} aria-hidden="true" />
          <input
            id="site-search"
            value={query}
            onFocus={() => setSearchFocused(true)}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
          />
          <Button type="submit" className="search-submit">{t("search")}</Button>
          {searchFocused && query && (
            <div className="search-panel">
              <p className="eyebrow">{t("matching")}</p>
              {searchMatches.length ? searchMatches.map((product) => (
                <button
                  key={product.slug}
                  type="button"
                  className="search-match"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setLocation(`/product/${product.slug}`);
                    setQuery("");
                    setSearchFocused(false);
                  }}
                >
                  <img src={product.image} alt="" />
                  <span><b>{product.brand}</b>{product.name}</span>
                  <ChevronRight size={16} />
                </button>
              )) : <p className="search-empty">{t("noMatches")}</p>}
            </div>
          )}
        </form>
        <div className="header-actions" aria-label={t("customerInfo")}>
          <div className="language-toggle" aria-label={t("language")}><button type="button" className={language === "bg" ? "is-active" : ""} onClick={() => setLanguage("bg")}>BG</button><button type="button" className={language === "en" ? "is-active" : ""} onClick={() => setLanguage("en")}>EN</button></div>
          <button type="button" onClick={() => doAction(t("account"))}><UserRound size={21} /><span>{t("account")}</span></button>
          <button type="button" onClick={() => doAction(t("favorites"))}><Heart size={21} /><span>{t("favorites")}</span></button>
          <Link href="/checkout?product=rtrmax-bormashina-udarna-710w-13mm-x-lion&qty=1" className="header-cart"><ShoppingCart size={21} /><span>{t("cart")}</span><i>1</i></Link>
        </div>
        <button type="button" className="mobile-menu-toggle" onClick={() => setMobileOpen(true)} aria-label={t("allCategories")}><Menu size={24} /></button>
      </div>

      <div className="nav-shell">
        <div className="page-frame primary-nav">
          <button type="button" className="catalogue-trigger" onClick={() => setMegaOpen(!megaOpen)} aria-expanded={megaOpen}>
            <Menu size={20} /> {t("allCategories")} <ChevronDown size={16} />
          </button>
          <nav aria-label="Основна навигация" className="desktop-links">
            <Link href="/">{t("home")}</Link>
            <Link href="/category/instrumenti">{t("tools")}</Link>
            <Link href="/category/gradina">{t("garden")}</Link>
            <Link href="/category/stroitelstvo">{t("construction")}</Link>
            <Link href="/category/boi-lakove-mazilki">{t("paints")}</Link>
            <Link href="/about">{t("about")}</Link>
            <Link href="/contact">{t("storeContacts")}</Link>
          </nav>
          <Link href="/category/instrumenti" className="promo-nav-link"><span>{t("promo")}</span> {t("viewOffers")}</Link>
        </div>
      </div>

      {megaOpen && (
        <div className="mega-menu" onMouseLeave={() => setMegaOpen(false)}>
          <div className="page-frame mega-grid">
            <aside className="mega-intro">
              <span className="signal-line" />
              <p className="eyebrow">{t("catalogue")}</p>
              <h2>{t("chooseTask")}</h2>
              <p>{t("catalogueIntro")}</p>
              <Link href="/category/instrumenti" onClick={() => setMegaOpen(false)} className="text-link">{t("viewAllProducts")} <ArrowRight size={16} /></Link>
            </aside>
            <div className="mega-categories">
              {categories.map((category) => {
                const Icon = categoryIcons[category.icon];
                return <Link key={category.slug} href={`/category/${category.slug}`} onClick={() => setMegaOpen(false)} className="mega-category">
                  <Icon size={19} />
                  <span>{category.label}</span>
                  <ChevronRight size={16} />
                </Link>;
              })}
            </div>
          </div>
        </div>
      )}

      {mobileOpen && (
        <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label={t("allCategories")}>
          <div className="mobile-drawer-head"><Wordmark /><div className="mobile-drawer-actions"><div className="language-toggle" aria-label={t("language")}><button type="button" className={language === "bg" ? "is-active" : ""} onClick={() => setLanguage("bg")}>BG</button><button type="button" className={language === "en" ? "is-active" : ""} onClick={() => setLanguage("en")}>EN</button></div><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close"><X size={24} /></button></div></div>
          <div className="mobile-drawer-links">
            <Link href="/" onClick={() => setMobileOpen(false)}>{t("home")}</Link>
            <Link href="/about" onClick={() => setMobileOpen(false)}>{t("about")}</Link>
            <Link href="/delivery" onClick={() => setMobileOpen(false)}>{t("delivery")}</Link>
            <Link href="/contact" onClick={() => setMobileOpen(false)}>{t("contacts")}</Link>
          </div>
          <p className="mobile-drawer-label">{t("categories")}</p>
          <div className="mobile-category-grid">
            {categories.map((category) => {
              const Icon = categoryIcons[category.icon];
              return <Link key={category.slug} href={`/category/${category.slug}`} onClick={() => setMobileOpen(false)}><Icon size={18} /> {category.label}</Link>;
            })}
          </div>
          <div className="mobile-contact"><Phone size={18} /><span><b>{t("help")}</b>{store.phones[2]}</span></div>
        </div>
      )}
      {location !== "/" && <div className="page-frame breadcrumb-rail"><Link href="/">{t("home")}</Link><ChevronRight size={14} /><span>{location.startsWith("/category") ? t("catalogue") : location.startsWith("/product") ? t("representativeProduct") : t("customerInfo")}</span></div>}
    </header>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#f7f7f4] text-[#1e262c]"><Header />{children}<Footer /></div>;
}

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="footer-cta"><div className="page-frame footer-cta-inner"><div><span className="eyebrow">{t("help")}</span><h2>{t("contacts")}</h2></div><Link href="/contact" className="button-ghost-light">{t("contacts")} <ArrowRight size={18} /></Link></div></div>
      <div className="page-frame footer-main">
        <div className="footer-brand">
          <Wordmark />
          <p>{t("catalogueIntro")}</p>
          <a className="footer-contact-line" href={`tel:${store.phones[2].replace(/[^0-9+]/g, "")}`}><Phone size={16} /> {store.phones[2]}</a>
          <a className="footer-contact-line" href={`mailto:${store.email}`}><Mail size={16} /> {store.email}</a>
          <img className="existing-brand-logo" src="/manus-storage/joan-existing-logo_61725b9d.webp" alt="Съществуващо лого на Строителен хипермаркет Жоан" />
        </div>
        <div><h3>{t("categories")}</h3>{categories.slice(0, 6).map((category) => <Link key={category.slug} href={`/category/${category.slug}`}>{category.label}</Link>)}</div>
        <div><h3>{t("customerInfo")}</h3><Link href="/delivery">{t("delivery")}</Link><Link href="/terms">{t("terms")}</Link><Link href="/contact">{languageText(t, "Работно време", "Opening hours")}</Link><Link href="/checkout?product=rtrmax-bormashina-udarna-710w-13mm-x-lion&qty=1">{t("checkoutNav")}</Link><button type="button" onClick={() => toast(t("mockSecurity"))}>{t("returns")}</button></div>
        <div><h3>{t("business")}</h3><p className="footer-address"><MapPin size={16} /> {store.address}</p><p className="footer-address"><Clock3 size={16} /> Пн–Пт: 08:00–19:00</p><Link href="/about">{t("about")}</Link><Link href="/contact">{t("contacts")}</Link><a href="https://www.facebook.com/www.joan.bg" target="_blank" rel="noreferrer"><Facebook size={15} /> Facebook</a></div>
      </div>
      <div className="footer-bottom"><div className="page-frame"><span>© {new Date().getFullYear()} ЖОАН. Всички права запазени.</span><span>Статичен демонстрационен storefront, подготвен за каталогова интеграция.</span></div></div>
    </footer>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  const { t } = useLanguage();
  return <nav className="breadcrumbs" aria-label={t("catalogue")}><Link href="/">{t("home")}</Link>{items.map((item) => <span key={item.label}><ChevronRight size={14} />{item.href ? <Link href={item.href}>{item.label}</Link> : <b>{item.label}</b>}</span>)}</nav>;
}

export function SectionHeading({ eyebrow, title, text, action }: { eyebrow?: string; title: string; text?: string; action?: ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2>{text && <p>{text}</p>}</div>{action}</div>;
}

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  function action(label: string) {
    toast(`${label}: ${product.name}`);
  }
  return (
    <article className={`product-card ${compact ? "product-card-compact" : ""}`}>
      <div className="product-image-box">
        {product.discount && <span className="discount-tag">{t("promo")} {product.discount}</span>}
        <button type="button" aria-label={`${t("favorites")}: ${product.name}`} className="product-icon-button" onClick={() => action(t("favorites"))}><Heart size={18} /></button>
        <Link href={`/product/${product.slug}`}><img src={product.image} alt={product.imageAlt} loading={compact ? "lazy" : "eager"} /></Link>
      </div>
      <div className="product-card-body">
        <p className="product-brand">{product.brand || "ЖОАН"}</p>
        <Link href={`/product/${product.slug}`} className="product-title">{product.name}</Link>
        {!compact && <p className="product-features">{product.features.slice(0, 2).join(" · ")}</p>}
        <div className="product-buy-row">
          <div className="product-price">
            {product.price ? <><span className="old-price">{product.oldPrice} <small>{product.oldPriceBgn}</small></span><b>{product.price}</b><small>{product.priceBgn}</small></> : <b className="ask-price">{t("enquiry")}</b>}
          </div>
          {product.price ? <Link href={`/checkout?product=${product.slug}&qty=1`} className="cart-square" aria-label={`${t("checkout")}: ${product.name}`}><ShoppingCart size={19} /></Link> : <button type="button" className="cart-square" aria-label={`${t("enquiry")}: ${product.name}`} onClick={() => { setLocation("/contact"); toast(t("productEnquiry")); }}><MessageCircle size={19} /></button>}
        </div>
        <div className="availability"><span />{t("checkAvailability")}</div>
      </div>
    </article>
  );
}

export function ServiceStrip() {
  const { language, t } = useLanguage();
  return <section className="service-strip" aria-label={t("business")}><div className="page-frame service-grid"><div><Truck /><span><b>{languageText(t, "Експресна доставка", "Express delivery")}</b><small>{languageText(t, "След потвърждение от оператор", "After operator confirmation")}</small></span></div><div><PackageCheck /><span><b>{languageText(t, "20 000+ артикула на склад", "20,000+ items in stock")}</b><small>{languageText(t, "Според публикуваната информация на Жоан", "According to Joan’s published information")}</small></span></div><div><MapPin /><span><b>{languageText(t, "Магазин в Силистра", "Store in Silistra")}</b><small>ул. Тутракан №22</small></span></div><div><Phone /><span><b>{t("help")}</b><small>{store.phones[2]}</small></span></div></div></section>;
}

function languageText(t: (key: "language") => string, bg: string, en: string) { return t("language") === "Language" ? en : bg; }

export function CategoryIcon({ icon, size = 22 }: { icon: keyof typeof categoryIcons; size?: number }) {
  const Icon = categoryIcons[icon];
  return <Icon size={size} />;
}

export function JsonLd({ product }: { product?: Product }) {
  const data = product ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    image: product.image,
    description: product.description,
    offers: product.price ? { "@type": "Offer", priceCurrency: "EUR", price: product.price.replace("€", ""), availability: "https://schema.org/LimitedAvailability" } : undefined,
  } : {
    "@context": "https://schema.org",
    "@type": "HardwareStore",
    name: "ЖОАН",
    email: store.email,
    telephone: store.phones[2],
    address: { "@type": "PostalAddress", streetAddress: "ул. Тутракан №22", addressLocality: "Силистра", addressCountry: "BG" },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
