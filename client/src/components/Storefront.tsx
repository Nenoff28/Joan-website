/**
 * DESIGN REMINDER — Red Workshop Modernism: dense, direct commerce hierarchy;
 * Joan Signal Red denotes action and selection only; neutral mineral surfaces keep products primary.
 */
import { Button } from "@/components/ui/button";
import { store, type Product } from "@/lib/storeData";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useCart } from "@/contexts/CartContext";
import { useCatalogue } from "@/hooks/useCatalogue";
import type { CatalogueCategory } from "@/hooks/useCatalogue";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  ArrowUp,
  Bath,
  BrickWall,
  ChevronRight,
  Drill,
  HardHat,
  Heart,
  House,
  LampDesk,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  PackageCheck,
  PanelsTopLeft,
  PaintRoller,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
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
      <img src="/manus-storage/joan-existing-logo_61725b9d.webp" alt="Лого на Строителен хипермаркет Жоан" className="brand-real-logo" />
    </Link>
  );
}

function categoryPath(slug: string, labels: string[] = []) {
  const search = labels.length ? `?path=${encodeURIComponent(labels.join(" > "))}` : "";
  return `/category/${slug}${search}`;
}

function MegaCategoryTree({ category, onNavigate }: { category: CatalogueCategory; onNavigate: () => void }) {
  const Icon = categoryIcons[category.icon];
  return <section className="mega-category-tree">
    <Link href={categoryPath(category.slug)} onClick={onNavigate} className="mega-category-heading"><Icon size={18} /><span>{category.label}</span><ChevronRight size={15} /></Link>
    <div className="mega-category-groups">{category.subcategories.map((group) => <div className="mega-category-group" key={group.label}>
      <Link href={categoryPath(category.slug, [group.label])} onClick={onNavigate}>{group.label}</Link>
      {group.children?.length ? <div className="mega-category-leaves">{group.children.map((child) => <Link key={child.label} href={categoryPath(category.slug, [group.label, child.label])} onClick={onNavigate}>{child.label}</Link>)}</div> : null}
    </div>)}</div>
  </section>;
}

function MobileCategoryTree({ category, onNavigate }: { category: CatalogueCategory; onNavigate: () => void }) {
  const Icon = categoryIcons[category.icon];
  return <details className="mobile-category-tree">
    <summary><Icon size={18} /><span>{category.label}</span><ChevronRight size={16} /></summary>
    <div className="mobile-category-tree-content"><Link href={categoryPath(category.slug)} onClick={onNavigate} className="mobile-category-all">Всички в {category.label}</Link>
      {category.subcategories.map((group) => <details key={group.label} className="mobile-category-branch"><summary>{group.label}<ChevronRight size={15} /></summary>
        <div>{group.children?.length ? group.children.map((child) => <Link key={child.label} href={categoryPath(category.slug, [group.label, child.label])} onClick={onNavigate}>{child.label}</Link>) : <Link href={categoryPath(category.slug, [group.label])} onClick={onNavigate}>Отвори {group.label}</Link>}</div>
      </details>)}
    </div>
  </details>;
}

function Header() {
  const { language, setLanguage, t } = useLanguage();
  const { count } = useFavorites();
  const { categories, products } = useCatalogue();
  const [location, setLocation] = useLocation();
  const [megaOpen, setMegaOpen] = useState(false);
  const [activeMegaCategory, setActiveMegaCategory] = useState("instrumenti");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { items: cartItems, count: cartCount, addItem, removeItem, setQuantity } = useCart();
  const cartRows = cartItems.flatMap((line) => {
    const product = products.find((item) => item.slug === line.slug);
    return product ? [{ product, quantity: line.quantity }] : [];
  });
  const cartTotal = cartRows.reduce((total, row) => total + (Number(row.product.price?.replace("€", "")) || 0) * row.quantity, 0);
  const cartCopy = language === "bg" ? { heading: "Вашата количка", empty: "Количката е празна.", browse: "Разгледайте продуктите", remove: "Премахни", review: "Преглед на цялата количка", count: "артикула", total: "Общо" } : { heading: "Your cart", empty: "Your cart is empty.", browse: "Browse products", remove: "Remove", review: "Review full cart", count: "items", total: "Total" };
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
    setLocation("/products");
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
          <p><Truck size={14} /> {language === "bg" ? "Експресна доставка" : "Express delivery"}</p>
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
          <div className="language-toggle" aria-label={t("language")}><button type="button" aria-label="Български" aria-pressed={language === "bg"} className={language === "bg" ? "is-active" : ""} onClick={() => setLanguage("bg")}><span className="flag-icon flag-bg" aria-hidden="true" /></button><button type="button" aria-label="English" aria-pressed={language === "en"} className={language === "en" ? "is-active" : ""} onClick={() => setLanguage("en")}><span className="flag-icon flag-en" aria-hidden="true" /></button></div>
          <button type="button" onClick={() => doAction(t("account"))}><UserRound size={21} /><span>{t("account")}</span></button>
          <Link href="/favorites" className="header-favorites" aria-label={t("favorites")}><Heart size={21} /><span>{t("favorites")}</span>{count > 0 && <i>{count}</i>}</Link>
          <div className="header-cart-wrap"><button type="button" className="header-cart" onClick={() => setCartOpen((open) => !open)} aria-expanded={cartOpen} aria-controls="header-mini-cart"><ShoppingCart size={21} /><span>{t("cart")}</span>{cartCount > 0 && <i>{cartCount}</i>}</button>{cartOpen && <MiniCart id="header-mini-cart" rows={cartRows} total={cartTotal} copy={cartCopy} onClose={() => setCartOpen(false)} onIncrement={(slug) => addItem(slug)} onDecrement={(slug, quantity) => setQuantity(slug, quantity - 1)} onRemove={removeItem} />}</div>
        </div>
        <button type="button" className="mobile-cart-toggle" onClick={() => setMobileOpen(true)} aria-label={`${t("cart")}: ${cartCount}`}><ShoppingCart size={22} />{cartCount > 0 && <i>{cartCount}</i>}</button><button type="button" className="mobile-menu-toggle" onClick={() => setMobileOpen(true)} aria-label={t("allCategories")}><Menu size={24} /></button>
      </div>

      <div className="nav-shell">
        <div className="page-frame primary-nav">
          <button type="button" className="catalogue-trigger" onClick={() => setMegaOpen(!megaOpen)} aria-expanded={megaOpen} aria-controls="catalogue-mega-menu" aria-label={t("allCategories")}>
            <Menu size={22} aria-hidden="true" />
          </button>
          <nav aria-label="Основна навигация" className="desktop-links">
            <Link href="/">{t("home")}</Link>
            <Link href="/about">{t("about")}</Link>
            <Link href="/contact">{t("storeContacts")}</Link>
            <Link href="/faq" className="faq-nav-link" aria-label="Често задавани въпроси">FAQ</Link>
          </nav>
          <Link href="/category/instrumenti" className="promo-nav-link"><span>{t("promo")}</span> {t("viewOffers")}</Link>
        </div>
      </div>

      {megaOpen && (
        <div id="catalogue-mega-menu" className="mega-menu" onMouseLeave={() => setMegaOpen(false)}>
          <div className="page-frame mega-grid">
            <aside className="mega-intro">
              <span className="signal-line" />
              <p className="eyebrow">{t("catalogue")}</p>
              <h2>{t("chooseTask")}</h2>
              <p>{t("catalogueIntro")}</p>
              <Link href="/products" onClick={() => setMegaOpen(false)} className="text-link">{t("viewAllProducts")} <ArrowRight size={16} /></Link>
            </aside>
            <div className="mega-catalogue-workspace"><div className="mega-category-tabs" role="tablist" aria-label={t("categories")}>{categories.map((category) => {
              const Icon = categoryIcons[category.icon]; const isActive = category.slug === activeMegaCategory;
              return <button key={category.slug} type="button" role="tab" aria-selected={isActive} aria-controls="active-mega-category" className={isActive ? "is-active" : ""} onClick={() => setActiveMegaCategory(category.slug)}><Icon size={15} /><span>{category.label}</span></button>;
            })}</div><div id="active-mega-category" role="tabpanel" className="mega-categories">{(() => { const category = categories.find((item) => item.slug === activeMegaCategory) ?? categories[0]; return category ? <MegaCategoryTree category={category} onNavigate={() => setMegaOpen(false)} /> : null; })()}</div></div>
          </div>
        </div>
      )}

      {mobileOpen && (
        <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label={t("allCategories")}>
          <div className="mobile-drawer-head"><Wordmark /><div className="mobile-drawer-actions"><div className="language-toggle" aria-label={t("language")}><button type="button" aria-label="Български" aria-pressed={language === "bg"} className={language === "bg" ? "is-active" : ""} onClick={() => setLanguage("bg")}><span className="flag-icon flag-bg" aria-hidden="true" /></button><button type="button" aria-label="English" aria-pressed={language === "en"} className={language === "en" ? "is-active" : ""} onClick={() => setLanguage("en")}><span className="flag-icon flag-en" aria-hidden="true" /></button></div><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close"><X size={24} /></button></div></div>
          <form className="mobile-search-wrap" onSubmit={(event) => { submitSearch(event); setMobileOpen(false); }} role="search"><label htmlFor="mobile-site-search" className="sr-only">{t("searchLabel")}</label><Search size={18} aria-hidden="true" /><input id="mobile-site-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPlaceholder")} autoComplete="off" /><Button type="submit" className="search-submit">{t("search")}</Button></form>
          {query && <div className="mobile-search-results" aria-live="polite">{searchMatches.length ? searchMatches.map((product) => <button key={product.slug} type="button" onClick={() => { setLocation(`/product/${product.slug}`); setQuery(""); setSearchFocused(false); setMobileOpen(false); }}><img src={product.image} alt="" /><span><b>{product.brand}</b>{product.name}</span><ChevronRight size={16} /></button>) : <p>{t("noMatches")}</p>}</div>}
          <MiniCart id="mobile-mini-cart" rows={cartRows} total={cartTotal} copy={cartCopy} onClose={() => setMobileOpen(false)} onIncrement={(slug) => addItem(slug)} onDecrement={(slug, quantity) => setQuantity(slug, quantity - 1)} onRemove={removeItem} />
          <div className="mobile-drawer-links">
            <Link href="/" onClick={() => setMobileOpen(false)}>{t("home")}</Link>
            <Link href="/about" onClick={() => setMobileOpen(false)}>{t("about")}</Link>
            <Link href="/delivery" onClick={() => setMobileOpen(false)}>{t("delivery")}</Link>
            <Link href="/contact" onClick={() => setMobileOpen(false)}>{t("contacts")}</Link>
            <Link href="/faq" onClick={() => setMobileOpen(false)} aria-label="Често задавани въпроси">FAQ</Link>
            <Link href="/favorites" onClick={() => setMobileOpen(false)}><Heart size={18} /> {t("favorites")}{count > 0 && ` (${count})`}</Link>
          </div>
          <Link href="/products" onClick={() => setMobileOpen(false)} className="mobile-all-products">{t("viewAllProducts")} <ArrowRight size={17} /></Link>
          <p className="mobile-drawer-label">{t("categories")}</p>
          <div className="mobile-category-grid">{categories.map((category) => <MobileCategoryTree key={category.slug} category={category} onNavigate={() => setMobileOpen(false)} />)}</div>
          <div className="mobile-contact"><Phone size={18} /><span><b>{t("help")}</b>{store.phones[2]}</span></div>
        </div>
      )}
      {location !== "/" && <div className="page-frame breadcrumb-rail"><Link href="/">{t("home")}</Link><ChevronRight size={14} /><span>{location === "/products" || location.startsWith("/category") ? t("catalogue") : location.startsWith("/product/") ? t("representativeProduct") : location.startsWith("/favorites") ? t("favorites") : t("customerInfo")}</span></div>}
    </header>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#f7f7f4] text-[#1e262c]"><Header />{children}<Footer /><BackToTop /></div>;
}

type MiniCartProps = { id: string; rows: { product: Product; quantity: number }[]; total: number; copy: { heading: string; empty: string; browse: string; remove: string; review: string; count: string; total: string }; onClose: () => void; onIncrement: (slug: string) => void; onDecrement: (slug: string, quantity: number) => void; onRemove: (slug: string) => void };
function MiniCart({ id, rows, total, copy, onClose, onIncrement, onDecrement, onRemove }: MiniCartProps) {
  return <section id={id} className="mini-cart" aria-label={copy.heading}><div className="mini-cart-heading"><div><p className="eyebrow">{copy.heading}</p><h2>{rows.reduce((sum, row) => sum + row.quantity, 0)} {copy.count}</h2></div><button type="button" onClick={onClose} aria-label="Затвори количката"><X size={17} /></button></div>{rows.length ? <><div className="mini-cart-items">{rows.map(({ product, quantity }) => <article key={product.slug} className="mini-cart-item"><img src={product.image} alt="" /><div><p className="product-brand">{product.brand}</p><b>{product.name}</b><span>{product.price ?? "Запитване"}</span><div className="mini-cart-quantity"><button type="button" onClick={() => onDecrement(product.slug, quantity)} aria-label={`Намали количеството на ${product.name}`}><Minus size={14} /></button><output aria-label={`Количество ${product.name}`}>{quantity}</output><button type="button" onClick={() => onIncrement(product.slug)} aria-label={`Увеличи количеството на ${product.name}`}><Plus size={14} /></button><button type="button" className="mini-cart-remove" onClick={() => onRemove(product.slug)} aria-label={`${copy.remove}: ${product.name}`}><Trash2 size={14} /></button></div></div></article>)}</div><div className="mini-cart-total"><span>{copy.total}</span><strong>{total ? `${total.toFixed(2)}€` : "Запитване"}</strong></div><Link href="/checkout" className="mini-cart-checkout" onClick={onClose}>{copy.review}<ArrowRight size={16} /></Link></> : <div className="mini-cart-empty"><ShoppingCart size={22} /><p>{copy.empty}</p><Link href="/products" onClick={onClose}>{copy.browse} <ArrowRight size={15} /></Link></div>}</section>;
}

function BackToTop() {
  const { language } = useLanguage();
  const [visible, setVisible] = useState(false);
  const label = language === "en" ? "Back to top" : "Към началото";

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 420);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (!visible) return null;

  return <button type="button" className="back-to-top" aria-label={label} title={label} onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}><ArrowUp size={18} /><span>{label}</span></button>;
}

function Footer() {
  const { t } = useLanguage();
  const { categories } = useCatalogue();
  const [location] = useLocation();
  const isContactPage = location === "/contact";
  return (
    <footer className="site-footer">
      {!isContactPage && <div className="footer-cta"><div className="page-frame footer-cta-inner"><div><span className="eyebrow">{t("help")}</span><h2>{t("contacts")}</h2></div><Link href="/contact" className="button-ghost-light">{t("contacts")} <ArrowRight size={18} /></Link></div></div>}
      <div className="page-frame footer-main">
        <div className="footer-brand">
          <Wordmark />
          <p>{t("catalogueIntro")}</p>
          <a className="footer-contact-line" href={`tel:${store.phones[2].replace(/[^0-9+]/g, "")}`}><Phone size={16} /> {store.phones[2]}</a>
          <a className="footer-contact-line" href={`mailto:${store.email}`}><Mail size={16} /> {store.email}</a>
        </div>
        <div><h3>{t("categories")}</h3><Link href="/products">{t("viewAllProducts")}</Link>{categories.slice(0, 6).map((category) => <Link key={category.slug} href={`/category/${category.slug}`}>{category.label}</Link>)}</div>
        <div><h3>{t("customerInfo")}</h3><Link href="/delivery">{t("delivery")}</Link><Link href="/terms">{t("terms")}</Link><Link href="/faq">FAQ</Link><Link href="/returns" className="footer-return-link">{t("returns")}</Link><Link href="/checkout">{t("checkoutNav")}</Link></div>
        <div><h3>{t("business")}</h3><p className="footer-address"><MapPin size={16} /> {store.address}</p><Link href="/about">{t("about")}</Link>{!isContactPage && <Link href="/contact">{t("contacts")}</Link>}<a className="footer-facebook" href="https://www.facebook.com/www.joan.bg" target="_blank" rel="noreferrer" aria-label="Facebook на ЖОАН" title="Facebook на ЖОАН"><img src="/manus-storage/joan-facebook-icon_f29d2620.webp" alt="" /></a></div>
      </div>
      <div className="footer-bottom"><div className="page-frame"><span>© {new Date().getFullYear()} ЖОАН. Всички права запазени.</span><span>Онлайн каталог с потвърждение на наличност и доставка от екипа на Жоан.</span></div></div>
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
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addItem } = useCart();
  const [, setLocation] = useLocation();
  const favorite = isFavorite(product.slug);
  function handleFavorite() {
    toggleFavorite(product.slug);
    toast(favorite ? t("removedFromFavorites") : t("addedToFavorites"));
  }
  return (
    <article className={`product-card ${compact ? "product-card-compact" : ""}`}>
      <div className="product-image-box">
        {product.discount && <span className="discount-tag">{t("promo")} {product.discount}</span>}
        <button type="button" aria-label={`${t("favorites")}: ${product.name}`} aria-pressed={favorite} className={`product-icon-button ${favorite ? "is-favorite" : ""}`} onClick={handleFavorite}><Heart size={18} fill={favorite ? "currentColor" : "none"} /></button>
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
          {product.price ? <button type="button" className="cart-square" aria-label={`${t("cart")}: ${product.name}`} onClick={() => { addItem(product.slug); toast(t("cart") === "Количка" ? "Артикулът е добавен в количката." : "Item added to cart."); }}><ShoppingCart size={19} /></button> : <button type="button" className="cart-square" aria-label={`${t("enquiry")}: ${product.name}`} onClick={() => { setLocation("/contact"); toast(t("productEnquiry")); }}><MessageCircle size={19} /></button>}
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
