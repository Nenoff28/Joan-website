/** Catalogue workbench: supports focused category browsing and the dedicated complete product listing. */
import { Breadcrumbs, CategoryIcon, JsonLd, Layout, PageMeta, ProductCard } from "@/components/Storefront";
import { useCatalogue } from "@/hooks/useCatalogue";
import type { CatalogueCategory, ManagedProduct } from "@/hooks/useCatalogue";
import type { CategoryNode } from "@/lib/categoryHierarchy";
import { ArrowRight, ChevronDown, Grid2X2, Layers3, ListFilter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute, useSearch } from "wouter";

const priceOf = (value?: string) => Number(value?.replace("€", "") ?? 0);
const pathLink = (slug: string, labels: string[] = []) => `/category/${slug}${labels.length ? `?path=${encodeURIComponent(labels.join(" > "))}` : ""}`;

function CategoryHierarchy({ category, selectedPath, onSelect }: { category: CatalogueCategory; selectedPath: string; onSelect: (path: string[]) => void }) {
  return <section className="category-hierarchy-browser" aria-label={`Подкатегории в ${category.label}`}>
    <div className="category-hierarchy-heading"><div><p className="eyebrow">Подкатегории</p><h2>Изберете вид продукт</h2></div><button type="button" className={!selectedPath ? "is-active" : ""} onClick={() => onSelect([])}>Всички в {category.label}</button></div>
    <div className="category-hierarchy-grid">{category.subcategories.map((node, index) => <article key={node.label} className="category-hierarchy-card">
      <button type="button" className={selectedPath === node.label ? "is-active" : ""} onClick={() => onSelect([node.label])}><span>0{index + 1}</span><b>{node.label}</b><ArrowRight size={16} /></button>
      {node.children?.length ? <div className="category-hierarchy-leaves">{node.children.map((child) => <button type="button" key={child.label} className={selectedPath === `${node.label} › ${child.label}` ? "is-active" : ""} onClick={() => onSelect([node.label, child.label])}>{child.label}</button>)}</div> : <p>Готово за продуктови записи</p>}
    </article>)}</div>
  </section>;
}

function CategoryQuickLinks({ categories, onNavigate }: { categories: CatalogueCategory[]; onNavigate: (slug: string) => void }) {
  return <aside className="catalogue-density-panel catalogue-all-categories"><div className="catalogue-density-title"><span className="catalogue-rail" /><div><p className="eyebrow">Категории</p><h3>Ограничете по задача</h3></div></div><div className="catalogue-subcategory-grid">{categories.map((category, index) => <button type="button" key={category.slug} onClick={() => onNavigate(category.slug)}><b>{String(index + 1).padStart(2, "0")}</b><span>{category.label}</span><ChevronDown size={15} /></button>)}</div><p>Изберете категория, за да видите цялата й подкатегорийна структура.</p></aside>;
}

function CataloguePage({ showAll = false }: { showAll?: boolean }) {
  const [, params] = useRoute("/category/:slug");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { categories, products } = useCatalogue();
  const category = categories.find((item) => item.slug === params?.slug) ?? categories[0];
  const selectedPath = useMemo(() => showAll ? [] : new URLSearchParams(search).get("path")?.split(" > ").filter(Boolean) ?? [], [search, showAll]);
  const selectedPathLabel = selectedPath.join(" › ");
  const [sort, setSort] = useState("relevance");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("Всички марки");
  const [query, setQuery] = useState("");
  const [inStock, setInStock] = useState(false);
  const [enquiry, setEnquiry] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const baseProducts = useMemo(() => showAll ? products : products.filter((product) => product.category === category?.slug), [category?.slug, products, showAll]);
  const resetFilters = () => { setSelectedBrand("Всички марки"); setQuery(""); setInStock(false); setEnquiry(false); setMinPrice(""); setMaxPrice(""); setSort("relevance"); };
  useEffect(() => { resetFilters(); setFiltersOpen(false); }, [category?.slug, selectedPathLabel, showAll]);
  const visibleProducts = useMemo(() => {
    if (selectedPath.length) return [] as ManagedProduct[];
    const filtered = baseProducts.filter((item) => { const price = priceOf(item.price); const haystack = `${item.name} ${item.brand} ${item.features.join(" ")}`.toLocaleLowerCase("bg"); const availability = (!inStock && !enquiry) || (inStock && item.availability === "На склад") || (enquiry && item.availability === "По запитване"); return (selectedBrand === "Всички марки" || item.brand === selectedBrand) && availability && (!query || haystack.includes(query.toLocaleLowerCase("bg"))) && (!minPrice || price >= Number(minPrice)) && (!maxPrice || price <= Number(maxPrice)); });
    return [...filtered].sort((left, right) => sort === "price-asc" ? priceOf(left.price) - priceOf(right.price) : sort === "price-desc" ? priceOf(right.price) - priceOf(left.price) : sort === "name-asc" ? left.name.localeCompare(right.name, "bg") : sort === "name-desc" ? right.name.localeCompare(left.name, "bg") : 0);
  }, [baseProducts, enquiry, inStock, maxPrice, minPrice, query, selectedBrand, selectedPath.length, sort]);
  const brands = ["Всички марки", ...Array.from(new Set(baseProducts.map((product) => product.brand).filter((brand): brand is string => Boolean(brand))))];
  const selectSubcategory = (path: string[]) => setLocation(pathLink(category.slug, path));
  const title = showAll ? "Всички продукти" : category.label;
  const description = showAll ? "Пълният каталог на Жоан — филтрирайте по марка, наличност, цена и име." : category.description;
  const listingTitle = selectedPathLabel ? `Продукти в ${selectedPathLabel}` : showAll ? "Всички налични продукти" : `Продукти в ${category.label}`;
  return <Layout><PageMeta title={title} description={description} /><JsonLd /><main><div className="page-frame category-shell"><Breadcrumbs items={showAll ? [{ label: "Всички продукти" }] : [{ label: category.label }]} />
    {showAll ? <section className="all-products-hero"><p className="eyebrow">Пълен каталог</p><h1>Всички продукти</h1><p>Разгледайте всички публикувани артикули или преминете към конкретна категория и подкатегория.</p><div>{categories.map((item) => <Link key={item.slug} href={`/category/${item.slug}`}><CategoryIcon icon={item.icon} size={16} /> {item.label}</Link>)}</div></section> : <><section className="category-hero"><img src={category.image} alt="" /><div className="category-hero-overlay" /><div className="category-hero-content"><p className="eyebrow">Каталог Жоан</p><h1>{category.label}</h1><p>{category.description}</p></div></section><CategoryHierarchy category={category} selectedPath={selectedPathLabel} onSelect={selectSubcategory} /></>}
    <div className="category-content-row"><aside className={`filter-panel ${filtersOpen ? "is-open" : ""}`} aria-label="Филтри"><div className="filter-heading"><b>Филтри</b><button type="button" onClick={() => setFiltersOpen(false)}>Затвори</button></div><label className="filter-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={showAll ? "Търсете във всички продукти" : "Търсете в категорията"} /></label><details open><summary>Марка <ChevronDown size={16} /></summary><div className="filter-options">{brands.map((brand) => <label key={brand}><input type="radio" value={brand} checked={selectedBrand === brand} onChange={() => setSelectedBrand(brand)} /> <span>{brand}</span></label>)}</div></details><details open><summary>Наличност <ChevronDown size={16} /></summary><div className="filter-options muted-options"><label><input type="checkbox" checked={inStock} onChange={(event) => setInStock(event.target.checked)} /> <span>На склад</span></label><label><input type="checkbox" checked={enquiry} onChange={(event) => setEnquiry(event.target.checked)} /> <span>По запитване</span></label></div></details><details open><summary>Цена (€) <ChevronDown size={16} /></summary><div className="filter-price-range"><input value={minPrice} min="0" onChange={(event) => setMinPrice(event.target.value)} type="number" inputMode="decimal" placeholder="От" /><input value={maxPrice} min="0" onChange={(event) => setMaxPrice(event.target.value)} type="number" inputMode="decimal" placeholder="До" /></div></details><button type="button" className="filter-reset" onClick={resetFilters}><RotateCcw size={14} /> Изчисти филтрите</button></aside>
      <section className="listing-content"><div className="listing-heading"><div><p className="eyebrow">{showAll ? "Пълен каталог" : "Подбрани продукти"}</p><h2>{listingTitle}</h2><p>{selectedPathLabel ? "Тази подкатегория е готова за продуктови записи." : "Търсете, филтрирайте и подредете каталожните артикули по марка, наличност и цена."}</p>{selectedPathLabel && <div className="selected-subcategory-bar"><Layers3 size={16} /><span>Избрано: <b>{selectedPathLabel}</b></span><button type="button" onClick={() => selectSubcategory([])}>Всички в {category.label}</button></div>}</div><button type="button" className="mobile-filter" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={18} /> Филтри</button></div><div className="listing-tools"><span><Grid2X2 size={17} /> <b>{visibleProducts.length}</b> от {selectedPathLabel ? 0 : baseProducts.length} продукта</span><label>Сортиране <select value={sort} onChange={(event) => setSort(event.target.value)} disabled={Boolean(selectedPathLabel)}><option value="relevance">По актуалност</option><option value="price-asc">Цена: ниска към висока</option><option value="price-desc">Цена: висока към ниска</option><option value="name-asc">Име: А – Я</option><option value="name-desc">Име: Я – А</option></select></label></div>{visibleProducts.length ? <div className="catalogue-workbench"><div className="product-grid listing-grid">{visibleProducts.map((product) => <ProductCard key={product.slug} product={product} />)}</div>{showAll ? <CategoryQuickLinks categories={categories} onNavigate={(slug) => setLocation(`/category/${slug}`)} /> : <CategoryQuickLinks categories={categories.filter((item) => item.slug !== category.slug)} onNavigate={(slug) => setLocation(`/category/${slug}`)} />}</div> : <div className="empty-products"><ListFilter size={26} /><h3>{selectedPathLabel ? "Все още няма добавени артикули за тази подкатегория." : "Няма продукти за избрания филтър."}</h3><p>{selectedPathLabel ? `„${selectedPathLabel}“ е публикувана в навигацията. Артикулите ще се появят тук, когато бъдат добавени към тази подкатегория.` : "Изчистете активните филтри или променете търсенето."}</p>{selectedPathLabel ? <button type="button" className="filter-reset" onClick={() => selectSubcategory([])}><RotateCcw size={14} /> Към всички продукти в категорията</button> : <button type="button" className="filter-reset" onClick={resetFilters}><RotateCcw size={14} /> Покажи всички</button>}</div>}<div className="catalogue-note"><CategoryIcon icon={showAll ? "drill" : category.icon} size={25} /><p><b>Каталожни резултати.</b> {showAll ? "Изберете категория за подробна подкатегорийна структура." : selectedPathLabel ? "Подкатегорията е видима и готова за свързване с реални продуктови записи." : "Използвайте подкатегориите по-горе, за да стесните задача и тип продукт."}</p></div></section></div>
  </div></main></Layout>;
}

export default function Category() { return <CataloguePage />; }
export function AllProducts() { return <CataloguePage showAll />; }
