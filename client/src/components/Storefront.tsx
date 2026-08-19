/**
 * DESIGN REMINDER — Red Workshop Modernism: dense, direct commerce hierarchy;
 * Joan Signal Red denotes action and selection only; neutral mineral surfaces keep products primary.
 */
import { Button } from "@/components/ui/button";
import { categories, products, store, type Product } from "@/lib/storeData";
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
  SlidersHorizontal,
  Star,
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
  return (
    <Link href="/" className="brand-mark" aria-label="ЖОАН — към началната страница">
      <img src="/manus-storage/joan-symbol_8ab1677a.png" alt="" className="brand-symbol" />
      <span className="brand-word">ЖОАН</span>
      <span className="brand-subword">строителен хипермаркет</span>
    </Link>
  );
}

function Header() {
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
    toast("Показваме представителни продукти от категория Инструменти.");
  }

  function doAction(action: string) {
    toast(`${action} е част от подготвената клиентска функционалност и изисква свързване с магазинната система.`);
  }

  return (
    <header className="site-header">
      <div className="utility-rail">
        <div className="page-frame utility-inner">
          <p><Truck size={14} /> Експресна доставка след потвърждение от оператор</p>
          <div className="utility-actions">
            <Link href="/delivery">Доставка</Link>
            <Link href="/contact">Контакти</Link>
            <a href={`tel:${store.phones[2].replace(/[^0-9+]/g, "")}`}><Phone size={13} /> {store.phones[2]}</a>
          </div>
        </div>
      </div>

      <div className="page-frame masthead">
        <Wordmark />
        <form className="search-wrap" onSubmit={submitSearch} role="search">
          <label htmlFor="site-search" className="sr-only">Търсене в ЖОАН</label>
          <Search size={20} aria-hidden="true" />
          <input
            id="site-search"
            value={query}
            onFocus={() => setSearchFocused(true)}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Търсете продукт, категория, марка..."
            autoComplete="off"
          />
          <Button type="submit" className="search-submit">Търси</Button>
          {searchFocused && query && (
            <div className="search-panel">
              <p className="eyebrow">Подходящи предложения</p>
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
              )) : <p className="search-empty">Няма съвпадение в представителния каталог.</p>}
            </div>
          )}
        </form>
        <div className="header-actions" aria-label="Клиентски действия">
          <button type="button" onClick={() => doAction("Вход")}><UserRound size={21} /><span>Вход</span></button>
          <button type="button" onClick={() => doAction("Любими")}><Heart size={21} /><span>Любими</span></button>
          <button type="button" onClick={() => doAction("Количка")}><ShoppingCart size={21} /><span>Количка</span><i>0</i></button>
        </div>
        <button type="button" className="mobile-menu-toggle" onClick={() => setMobileOpen(true)} aria-label="Отвори менюто"><Menu size={24} /></button>
      </div>

      <div className="nav-shell">
        <div className="page-frame primary-nav">
          <button type="button" className="catalogue-trigger" onClick={() => setMegaOpen(!megaOpen)} aria-expanded={megaOpen}>
            <Menu size={20} /> Всички категории <ChevronDown size={16} />
          </button>
          <nav aria-label="Основна навигация" className="desktop-links">
            <Link href="/">Начало</Link>
            <Link href="/category/instrumenti">Инструменти</Link>
            <Link href="/category/gradina">Градина</Link>
            <Link href="/category/stroitelstvo">Строителство</Link>
            <Link href="/category/boi-lakove-mazilki">Бои и мазилки</Link>
            <Link href="/about">За Жоан</Link>
            <Link href="/contact">Магазин и контакти</Link>
          </nav>
          <Link href="/category/instrumenti" className="promo-nav-link"><span>ПРОМО</span> Виж предложенията</Link>
        </div>
      </div>

      {megaOpen && (
        <div className="mega-menu" onMouseLeave={() => setMegaOpen(false)}>
          <div className="page-frame mega-grid">
            <aside className="mega-intro">
              <span className="signal-line" />
              <p className="eyebrow">Каталог Жоан</p>
              <h2>Изберете по задача, не по догадки.</h2>
              <p>Подредени категории за ремонт, дом, градина и професионална работа.</p>
              <Link href="/category/instrumenti" onClick={() => setMegaOpen(false)} className="text-link">Виж всички продукти <ArrowRight size={16} /></Link>
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
        <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Навигация">
          <div className="mobile-drawer-head"><Wordmark /><button type="button" onClick={() => setMobileOpen(false)} aria-label="Затвори менюто"><X size={24} /></button></div>
          <div className="mobile-drawer-links">
            <Link href="/" onClick={() => setMobileOpen(false)}>Начало</Link>
            <Link href="/about" onClick={() => setMobileOpen(false)}>За Жоан</Link>
            <Link href="/delivery" onClick={() => setMobileOpen(false)}>Доставка</Link>
            <Link href="/contact" onClick={() => setMobileOpen(false)}>Контакти</Link>
          </div>
          <p className="mobile-drawer-label">Категории</p>
          <div className="mobile-category-grid">
            {categories.map((category) => {
              const Icon = categoryIcons[category.icon];
              return <Link key={category.slug} href={`/category/${category.slug}`} onClick={() => setMobileOpen(false)}><Icon size={18} /> {category.label}</Link>;
            })}
          </div>
          <div className="mobile-contact"><Phone size={18} /><span><b>Нужна е помощ?</b>{store.phones[2]}</span></div>
        </div>
      )}
      {location !== "/" && <div className="page-frame breadcrumb-rail"><Link href="/">Начало</Link><ChevronRight size={14} /><span>{location.startsWith("/category") ? "Каталог" : location.startsWith("/product") ? "Продукт" : "Информация"}</span></div>}
    </header>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#f7f7f4] text-[#1e262c]"><Header />{children}<Footer /></div>;
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-cta"><div className="page-frame footer-cta-inner"><div><span className="eyebrow">Нуждаете се от съдействие?</span><h2>Потърсете екипа на Жоан.</h2></div><Link href="/contact" className="button-ghost-light">Свържете се с нас <ArrowRight size={18} /></Link></div></div>
      <div className="page-frame footer-main">
        <div className="footer-brand">
          <Wordmark />
          <p>Строителен хипермаркет за материали, инструменти и решения за дома.</p>
          <a className="footer-contact-line" href={`tel:${store.phones[2].replace(/[^0-9+]/g, "")}`}><Phone size={16} /> {store.phones[2]}</a>
          <a className="footer-contact-line" href={`mailto:${store.email}`}><Mail size={16} /> {store.email}</a>
          <img className="existing-brand-logo" src="/manus-storage/joan-existing-logo_61725b9d.webp" alt="Съществуващо лого на Строителен хипермаркет Жоан" />
        </div>
        <div><h3>Категории</h3>{categories.slice(0, 6).map((category) => <Link key={category.slug} href={`/category/${category.slug}`}>{category.label}</Link>)}</div>
        <div><h3>Клиентска информация</h3><Link href="/delivery">Доставка</Link><Link href="/terms">Условия за ползване</Link><Link href="/contact">Работно време</Link><button type="button" onClick={() => toast("Профилът на клиента се свързва при бъдеща интеграция с магазинната система.")}>Профил на клиента</button><button type="button" onClick={() => toast("Връщанията ще се обработват чрез свързания магазинен процес.")}>Връщане</button></div>
        <div><h3>Магазин Жоан</h3><p className="footer-address"><MapPin size={16} /> {store.address}</p><p className="footer-address"><Clock3 size={16} /> Пн–Пт: 08:00–19:00</p><Link href="/about">За нас</Link><Link href="/contact">Контакти</Link><a href="https://www.facebook.com/www.joan.bg" target="_blank" rel="noreferrer"><Facebook size={15} /> Facebook</a></div>
      </div>
      <div className="footer-bottom"><div className="page-frame"><span>© {new Date().getFullYear()} ЖОАН. Всички права запазени.</span><span>Статичен демонстрационен storefront, подготвен за каталогова интеграция.</span></div></div>
    </footer>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return <nav className="breadcrumbs" aria-label="Навигационна пътека"><Link href="/">Начало</Link>{items.map((item) => <span key={item.label}><ChevronRight size={14} />{item.href ? <Link href={item.href}>{item.label}</Link> : <b>{item.label}</b>}</span>)}</nav>;
}

export function SectionHeading({ eyebrow, title, text, action }: { eyebrow?: string; title: string; text?: string; action?: ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2>{text && <p>{text}</p>}</div>{action}</div>;
}

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const [, setLocation] = useLocation();
  function action(label: string) {
    toast(`${label}: ${product.name}`);
  }
  return (
    <article className={`product-card ${compact ? "product-card-compact" : ""}`}>
      <div className="product-image-box">
        {product.discount && <span className="discount-tag">Промо {product.discount}</span>}
        <button type="button" aria-label={`Добави ${product.name} в любими`} className="product-icon-button" onClick={() => action("Добавено в любими")}><Heart size={18} /></button>
        <Link href={`/product/${product.slug}`}><img src={product.image} alt={product.imageAlt} loading={compact ? "lazy" : "eager"} /></Link>
      </div>
      <div className="product-card-body">
        <p className="product-brand">{product.brand || "ЖОАН"}</p>
        <Link href={`/product/${product.slug}`} className="product-title">{product.name}</Link>
        {!compact && <p className="product-features">{product.features.slice(0, 2).join(" · ")}</p>}
        <div className="product-buy-row">
          <div className="product-price">
            {product.price ? <><span className="old-price">{product.oldPrice} <small>{product.oldPriceBgn}</small></span><b>{product.price}</b><small>{product.priceBgn}</small></> : <b className="ask-price">Запитване</b>}
          </div>
          <button type="button" className="cart-square" aria-label={`Запитай за ${product.name}`} onClick={() => { setLocation("/contact"); toast("Изберете „Информация за продукт“ във формата за запитване."); }}><MessageCircle size={19} /></button>
        </div>
        <div className="availability"><span />{product.availability}</div>
      </div>
    </article>
  );
}

export function ServiceStrip() {
  return <section className="service-strip" aria-label="Услуги Жоан"><div className="page-frame service-grid"><div><Truck /><span><b>Експресна доставка</b><small>След потвърждение от оператор</small></span></div><div><PackageCheck /><span><b>20 000+ артикула на склад</b><small>Според публикуваната информация на Жоан</small></span></div><div><MapPin /><span><b>Магазин в Силистра</b><small>ул. Тутракан №22</small></span></div><div><Phone /><span><b>Нужна е помощ?</b><small>{store.phones[2]}</small></span></div></div></section>;
}

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
