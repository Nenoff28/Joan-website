/** DESIGN REMINDER — Red Workshop Modernism: a filterable workbench for fast product discovery, with Joan-red only on active decisions. */
import { Breadcrumbs, CategoryIcon, JsonLd, Layout, PageMeta, ProductCard } from "@/components/Storefront";
import { useCatalogue } from "@/hooks/useCatalogue";
import type { CategoryNode } from "@/lib/categoryHierarchy";
import { ChevronDown, Grid2X2, ListFilter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute, useSearch } from "wouter";

const priceOf = (value?: string) => Number(value?.replace("€", "") ?? 0);

function NestedCategoryChips({ nodes, onSelect }: { nodes: CategoryNode[]; onSelect: (path: string[]) => void }) {
  return <div className="category-subchips category-subtree">
    {nodes.map((node) => <details key={node.label} className="category-subtree-node">
      <summary onClick={() => onSelect([node.label])}>{node.label}<ChevronDown size={14} /></summary>
      {node.children?.length ? <div className="category-subtree-children">{node.children.map((child) => <button type="button" key={child.label} onClick={() => onSelect([node.label, child.label])}>{child.label}</button>)}</div> : null}
    </details>)}
  </div>;
}

export default function Category() {
  const [, params] = useRoute("/category/:slug");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { categories, products } = useCatalogue();
  const category = categories.find((item) => item.slug === params?.slug) ?? categories[0];
  const selectedPath = useMemo(() => new URLSearchParams(search).get("path")?.split(" > ").filter(Boolean) ?? [], [search]);
  const selectedPathLabel = selectedPath.join(" › ");
  const [sort, setSort] = useState("relevance");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("Всички марки");
  const [query, setQuery] = useState("");
  const [inStock, setInStock] = useState(false);
  const [enquiry, setEnquiry] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const categoryProducts = useMemo(() => products.filter((product) => product.category === category.slug), [category.slug, products]);
  const resetFilters = () => { setSelectedBrand("Всички марки"); setQuery(""); setInStock(false); setEnquiry(false); setMinPrice(""); setMaxPrice(""); setSort("relevance"); };

  useEffect(() => { resetFilters(); setFiltersOpen(false); }, [category.slug, selectedPathLabel]);

  const visibleProducts = useMemo(() => {
    if (selectedPath.length) return [];
    const filtered = categoryProducts.filter((item) => {
      const price = priceOf(item.price);
      const haystack = `${item.name} ${item.brand} ${item.features.join(" ")}`.toLocaleLowerCase("bg");
      const availabilityMatch = (!inStock && !enquiry) || (inStock && item.availability === "На склад") || (enquiry && item.availability === "По запитване");
      return (selectedBrand === "Всички марки" || item.brand === selectedBrand) && availabilityMatch && (!query || haystack.includes(query.toLocaleLowerCase("bg"))) && (!minPrice || price >= Number(minPrice)) && (!maxPrice || price <= Number(maxPrice));
    });
    return [...filtered].sort((left, right) => {
      if (sort === "price-asc") return priceOf(left.price) - priceOf(right.price);
      if (sort === "price-desc") return priceOf(right.price) - priceOf(left.price);
      if (sort === "name-asc") return left.name.localeCompare(right.name, "bg");
      if (sort === "name-desc") return right.name.localeCompare(left.name, "bg");
      return 0;
    });
  }, [categoryProducts, selectedBrand, inStock, enquiry, minPrice, maxPrice, query, selectedPath.length, sort]);
  const brands = ["Всички марки", ...Array.from(new Set(categoryProducts.map((product) => product.brand).filter((brand): brand is string => Boolean(brand))))];
  const selectSubcategory = (path: string[]) => setLocation(`/category/${category.slug}?path=${encodeURIComponent(path.join(" > "))}`);

  return <Layout>
    <PageMeta title={category.label} description={`${category.description} Открийте продукти и категории в ЖОАН.`} />
    <JsonLd />
    <main><div className="page-frame category-shell"><Breadcrumbs items={[{ label: category.label }]} /><section className="category-hero"><img src={category.image} alt="" /><div className="category-hero-overlay" /><div className="category-hero-content"><p className="eyebrow">Каталог Жоан</p><h1>{category.label}</h1><p>{category.description}</p><NestedCategoryChips nodes={category.subcategories} onSelect={selectSubcategory} />{selectedPathLabel && <p className="category-selected-path">Избрано: <b>{selectedPathLabel}</b></p>}</div></section>
      <div className="category-content-row"><aside className={`filter-panel ${filtersOpen ? "is-open" : ""}`} aria-label="Филтри"><div className="filter-heading"><b>Филтри</b><button type="button" onClick={() => setFiltersOpen(false)}>Затвори</button></div><label className="filter-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Търсете в категорията" /></label><details open><summary>Марка <ChevronDown size={16} /></summary><div className="filter-options">{brands.map((brand) => <label key={brand}><input type="radio" value={brand} checked={selectedBrand === brand} onChange={() => setSelectedBrand(brand)} /> <span>{brand}</span></label>)}</div></details><details open><summary>Наличност <ChevronDown size={16} /></summary><div className="filter-options muted-options"><label><input type="checkbox" checked={inStock} onChange={(event) => setInStock(event.target.checked)} /> <span>На склад</span></label><label><input type="checkbox" checked={enquiry} onChange={(event) => setEnquiry(event.target.checked)} /> <span>По запитване</span></label></div></details><details open><summary>Цена (€) <ChevronDown size={16} /></summary><div className="filter-price-range"><input value={minPrice} min="0" onChange={(event) => setMinPrice(event.target.value)} type="number" inputMode="decimal" placeholder="От" /><input value={maxPrice} min="0" onChange={(event) => setMaxPrice(event.target.value)} type="number" inputMode="decimal" placeholder="До" /></div></details><button type="button" className="filter-reset" onClick={resetFilters}><RotateCcw size={14} /> Изчисти филтрите</button></aside>
        <section className="listing-content"><div className="listing-heading"><div><p className="eyebrow">Подбрани продукти</p><h2>{selectedPathLabel ? `Продукти в ${selectedPathLabel}` : `Продукти в ${category.label}`}</h2><p>{selectedPathLabel ? "Тази подкатегория е готова за продуктови записи." : "Търсете, филтрирайте и подредете каталожните артикули по марка, наличност и цена."}</p></div><button type="button" className="mobile-filter" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={18} /> Филтри</button></div><div className="listing-tools"><span><Grid2X2 size={17} /> <b>{visibleProducts.length}</b> от {selectedPathLabel ? 0 : categoryProducts.length} продукта</span><label>Сортиране <select value={sort} onChange={(event) => setSort(event.target.value)} disabled={Boolean(selectedPathLabel)}><option value="relevance">По актуалност</option><option value="price-asc">Цена: ниска към висока</option><option value="price-desc">Цена: висока към ниска</option><option value="name-asc">Име: А – Я</option><option value="name-desc">Име: Я – А</option></select></label></div>{visibleProducts.length ? <div className="catalogue-workbench"><div className="product-grid listing-grid">{visibleProducts.map((product) => <ProductCard key={product.slug} product={product} />)}</div><aside className="catalogue-density-panel"><div className="catalogue-density-title"><span className="catalogue-rail" /><div><p className="eyebrow">Работна навигация</p><h3>Открийте по вид и задача</h3></div></div><div className="catalogue-subcategory-grid">{category.subcategories.map((node, index) => <button type="button" key={node.label} onClick={() => selectSubcategory([node.label])}><b>0{index + 1}</b><span>{node.label}</span><span className="subcategory-count">{node.children?.length ?? 0}</span><ChevronDown size={15} /></button>)}</div><div className="catalogue-density-spec"><span>Активни контроли</span><b>Марка · Наличност · Цена · Име</b></div><p>Филтрите работят с наличните каталожни артикули в тази категория.</p></aside></div> : <div className="empty-products"><ListFilter size={26} /><h3>{selectedPathLabel ? "Все още няма добавени артикули за тази подкатегория." : "Няма продукти за избрания филтър."}</h3><p>{selectedPathLabel ? `„${selectedPathLabel}“ е публикувана в навигацията. Артикулите ще се появят тук, когато бъдат добавени към тази подкатегория.` : "Изчистете активните филтри или променете търсенето."}</p>{selectedPathLabel ? <button type="button" className="filter-reset" onClick={() => setLocation(`/category/${category.slug}`)}><RotateCcw size={14} /> Към всички продукти в категорията</button> : <button type="button" className="filter-reset" onClick={resetFilters}><RotateCcw size={14} /> Покажи всички</button>}</div>}<div className="catalogue-note"><CategoryIcon icon={category.icon} size={25} /><p><b>Каталожни резултати.</b> {selectedPathLabel ? "Подкатегорията е видима и готова за свързване с реални продуктови записи." : "Използвайте контролите по-горе, за да ограничите списъка според задача и наличност."}</p></div></section></div>
    </div></main>
  </Layout>;
}
