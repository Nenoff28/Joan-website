/** Catalogue workbench: supports focused category browsing and the dedicated complete product listing. */
import { Breadcrumbs, CategoryIcon, JsonLd, Layout, PageMeta, ProductCard } from "@/components/Storefront";
import { useCatalogue, useCataloguePage } from "@/hooks/useCatalogue";
import type { CatalogueCategory } from "@/hooks/useCatalogue";
import { ArrowRight, ChevronDown, Grid2X2, ListFilter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute, useSearch } from "wouter";

const pathLink = (slug: string, labels: string[] = []) => `/category/${slug}${labels.length ? `?path=${encodeURIComponent(labels.join(" > "))}` : ""}`;

function CategoryHierarchy({ category, selectedPath, onSelect }: { category: CatalogueCategory; selectedPath: string; onSelect: (path: string[]) => void }) {
  return (
    <section className="category-hierarchy-browser" aria-label={`Подкатегории в ${category.label}`}>
      <div className="category-hierarchy-heading">
        <div><p className="eyebrow">Подкатегории</p><h2>Изберете вид продукт</h2></div>
        <button type="button" className={!selectedPath ? "is-active" : ""} onClick={() => onSelect([])}>Всички в {category.label}</button>
      </div>
      <div className="category-hierarchy-grid">
        {category.subcategories.map((node, index) => (
          <article key={node.label} className="category-hierarchy-card">
            <button type="button" className={selectedPath === node.label ? "is-active" : ""} onClick={() => onSelect([node.label])}>
              <span>0{index + 1}</span><b>{node.label}</b><ArrowRight size={16} />
            </button>
            {node.children?.length ? <div className="category-hierarchy-leaves">{node.children.map((child) => (
              <button type="button" key={child.label} className={selectedPath === `${node.label} › ${child.label}` ? "is-active" : ""} onClick={() => onSelect([node.label, child.label])}>{child.label}</button>
            ))}</div> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function CataloguePage({ showAll = false }: { showAll?: boolean }) {
  const [, params] = useRoute("/category/:slug");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { categories } = useCatalogue();
  const category = categories.find((item) => item.slug === params?.slug) ?? categories[0];
  const selectedPath = useMemo(() => showAll ? [] : new URLSearchParams(search).get("path")?.split(" > ").filter(Boolean) ?? [], [search, showAll]);
  const selectedPathLabel = selectedPath.join(" › ");
  const [sort, setSort] = useState("relevance");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("Всички марки");
  const [manufacturerQuery, setManufacturerQuery] = useState("");
  const [query, setQuery] = useState("");
  const [inStock, setInStock] = useState(false);
  const [enquiry, setEnquiry] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [page, setPage] = useState(1);
  const resetFilters = () => { setSelectedBrand("Всички марки"); setManufacturerQuery(""); setQuery(""); setInStock(false); setEnquiry(false); setMinPrice(""); setMaxPrice(""); setSort("relevance"); };

  useEffect(() => { resetFilters(); setFiltersOpen(false); setPage(1); }, [category?.slug, selectedPathLabel, showAll]);

  const pageSize = 48;
  const catalogueInput = useMemo(() => ({
    page,
    pageSize,
    categorySlug: showAll ? undefined : category?.slug,
    path: selectedPathLabel ? selectedPathLabel.split(" › ") : undefined,
    query: query || undefined,
    brand: selectedBrand === "Всички марки" ? undefined : selectedBrand,
    availability: [inStock ? "in_stock" : null, enquiry ? "on_request" : null].filter((value): value is "in_stock" | "on_request" => Boolean(value)),
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    sort: sort as "relevance" | "price-asc" | "price-desc" | "name-asc" | "name-desc",
  }), [category?.slug, enquiry, inStock, maxPrice, minPrice, page, pageSize, query, selectedBrand, selectedPathLabel, showAll, sort]);
  const cataloguePage = useCataloguePage(catalogueInput);
  const brands = ["Всички марки", ...cataloguePage.brands];
  const normalizedManufacturerQuery = manufacturerQuery.trim().toLocaleLowerCase("bg-BG");
  const matchingBrands = brands.filter((brand) => brand === "Всички марки" || !normalizedManufacturerQuery || brand.toLocaleLowerCase("bg-BG").includes(normalizedManufacturerQuery));
  const totalPages = Math.max(1, Math.ceil(cataloguePage.total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageProducts = cataloguePage.products;
  const navigateToCatalogue = (href: string) => { setPage(1); setFiltersOpen(false); setLocation(href); };
  const selectSubcategory = (path: string[]) => navigateToCatalogue(pathLink(category.slug, path));
  const title = showAll ? "Всички продукти" : category.label;
  const description = showAll ? "Пълният каталог на Жоан — филтрирайте по производител, наличност, цена и име." : category.description;
  const listingTitle = selectedPathLabel ? `Продукти в ${selectedPathLabel}` : showAll ? "Всички налични продукти" : `Продукти в ${category.label}`;

  return (
    <Layout>
      <PageMeta title={showAll ? title : category?.metaTitle || title} description={showAll ? description : category?.metaDescription || description} canonicalUrl={showAll ? undefined : category?.canonicalUrl} metaRobots={showAll ? undefined : category?.metaRobots} />
      <JsonLd />
      <main>
        <div className="page-frame category-shell">
          <Breadcrumbs items={showAll ? [{ label: "Всички продукти" }] : [{ label: category.label }]} />
          {showAll ? (
            <section className="all-products-hero">
              <p className="eyebrow">Пълен каталог</p><h1>Всички продукти</h1><p>Разгледайте всички публикувани артикули или преминете към конкретна категория и подкатегория.</p>
              <div>{categories.map((item) => <Link key={item.slug} href={`/category/${item.slug}`}><CategoryIcon icon={item.icon} size={16} /> {item.label}</Link>)}</div>
            </section>
          ) : (
            <>
              <section className="category-hero">
                <img src={category.image} alt="" /><div className="category-hero-overlay" />
                <div className="category-hero-content">
                  <p className="eyebrow">Каталог Жоан</p><h1>{category.label}</h1><p>{category.description}</p>
                  {selectedPathLabel && <div className="category-hero-path"><span>{selectedPath.join(" / ")}</span><button type="button" onClick={() => selectSubcategory([])}>Всички в {category.label}</button></div>}
                </div>
              </section>
              {!selectedPathLabel && <CategoryHierarchy category={category} selectedPath={selectedPathLabel} onSelect={selectSubcategory} />}
            </>
          )}
          <div className="category-content-row">
            <aside className={`filter-panel ${filtersOpen ? "is-open" : ""}`} aria-label="Филтри">
              <div className="filter-heading"><b>Филтри</b><button type="button" onClick={() => setFiltersOpen(false)}>Затвори</button></div>
              <label className="filter-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={showAll ? "Търсете във всички продукти" : "Търсете в категорията"} /></label>
              <details className="manufacturer-filter">
                <summary>Производител <ChevronDown size={16} /></summary>
                <div className="manufacturer-filter-content">
                  <label className="manufacturer-filter-search"><Search size={14} /><span className="sr-only">Търсене на производител</span><input value={manufacturerQuery} onChange={(event) => setManufacturerQuery(event.target.value)} placeholder="Търсене на производител" /></label>
                  <div className="filter-options">{matchingBrands.map((brand) => <label key={brand}><input type="radio" value={brand} checked={selectedBrand === brand} onChange={() => { setSelectedBrand(brand); setPage(1); }} /> <span>{brand === "Всички марки" ? "Всички производители" : brand}</span></label>)}</div>
                  {matchingBrands.length === 1 && normalizedManufacturerQuery ? <p className="manufacturer-empty">Няма намерен производител.</p> : null}
                </div>
              </details>
              <details open><summary>Наличност <ChevronDown size={16} /></summary><div className="filter-options muted-options"><label><input type="checkbox" checked={inStock} onChange={(event) => setInStock(event.target.checked)} /> <span>На склад</span></label><label><input type="checkbox" checked={enquiry} onChange={(event) => setEnquiry(event.target.checked)} /> <span>По запитване</span></label></div></details>
              <details open><summary>Цена (€) <ChevronDown size={16} /></summary><div className="filter-price-range"><input value={minPrice} min="0" onChange={(event) => setMinPrice(event.target.value)} type="number" inputMode="decimal" placeholder="От" /><input value={maxPrice} min="0" onChange={(event) => setMaxPrice(event.target.value)} type="number" inputMode="decimal" placeholder="До" /></div></details>
              <button type="button" className="filter-reset" onClick={resetFilters}><RotateCcw size={14} /> Изчисти филтрите</button>
            </aside>
            <section className={`listing-content ${selectedPathLabel ? "is-selected-subcategory" : ""}`}>
              {!selectedPathLabel && <div className="listing-heading"><div><p className="eyebrow">{showAll ? "Пълен каталог" : "Подбрани продукти"}</p><h2>{listingTitle}</h2><p>Търсете, филтрирайте и подредете каталожните артикули по производител, наличност и цена.</p></div><button type="button" className="mobile-filter" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={18} /> Филтри</button></div>}
              <div className="listing-tools">
                {selectedPathLabel && <button type="button" className="mobile-filter selected-path-filter" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={18} /> Филтри</button>}
                <span><Grid2X2 size={17} /> <b>{cataloguePage.total}</b> продукта</span>
                <label>Сортиране <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="relevance">По актуалност</option><option value="price-asc">Цена: ниска към висока</option><option value="price-desc">Цена: висока към ниска</option><option value="name-asc">Име: А – Я</option><option value="name-desc">Име: Я – А</option></select></label>
              </div>
              {cataloguePage.isLoading ? <div className="empty-products"><ListFilter size={26} /><h3>Зареждане на продукти…</h3><p>Извличаме само резултатите за избраната категория.</p></div> : pageProducts.length ? (
                <div className="catalogue-workbench"><div className="product-grid listing-grid">{pageProducts.map((product) => <ProductCard key={product.slug} product={product} />)}</div>{totalPages > 1 && <nav className="catalogue-pagination" aria-label="Страници с продукти"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Предишна</button><span>Страница <b>{currentPage}</b> от {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Следваща</button></nav>}</div>
              ) : <div className="empty-products"><ListFilter size={26} /><h3>Няма продукти за избрания филтър.</h3><p>Изчистете активните филтри, променете търсенето или се върнете към по-горна категория.</p><button type="button" className="filter-reset" onClick={resetFilters}><RotateCcw size={14} /> Покажи всички</button></div>}
              <div className="catalogue-note"><CategoryIcon icon={showAll ? "drill" : category.icon} size={25} /><p><b>Каталожни резултати.</b> {showAll ? "Изберете категория от горното меню за подробна подкатегорийна структура." : "Използвайте подкатегориите по-горе, за да стесните задача и тип продукт."}</p></div>
            </section>
          </div>
        </div>
      </main>
    </Layout>
  );
}

export default function Category() { return <CataloguePage />; }
export function AllProducts() { return <CataloguePage showAll />; }
