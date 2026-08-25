/** Catalogue workbench: supports focused category browsing and the dedicated complete product listing. */
import { Breadcrumbs, CategoryIcon, JsonLd, Layout, PageMeta, ProductCard } from "@/components/Storefront";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCatalogue, useCataloguePage } from "@/hooks/useCatalogue";
import type { CatalogueCategory } from "@/hooks/useCatalogue";
import { categoryLabelsFromTokens, categoryPathTokens } from "@/lib/categoryHierarchy";
import { paginationItems } from "@/lib/pagination";
import { ArrowRight, ChevronDown, Grid2X2, ListFilter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute, useSearch } from "wouter";

const pathLink = (slug: string, labels: string[] = []) => `/category/${slug}${labels.length ? `?path=${categoryPathTokens(labels).join("~")}` : ""}`;

function CategoryHierarchy({ category, selectedPath, onSelect }: { category: CatalogueCategory; selectedPath: string; onSelect: (path: string[]) => void }) {
  const { language } = useLanguage();
  const en = language === "en";
  return (
    <section className="category-hierarchy-browser" aria-label={`${en ? "Subcategories in" : "Подкатегории в"} ${category.label}`}>
      <div className="category-hierarchy-heading">
        <div><p className="eyebrow">{en ? "Subcategories" : "Подкатегории"}</p><h2>{en ? "Choose a product type" : "Изберете вид продукт"}</h2></div>
        <button type="button" className={!selectedPath ? "is-active" : ""} onClick={() => onSelect([])}>{en ? "All in" : "Всички в"} {category.label}</button>
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
  const { language } = useLanguage();
  const en = language === "en";
  const [, params] = useRoute("/category/:slug");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { categories } = useCatalogue();
  const category = categories.find((item) => item.slug === params?.slug) ?? categories[0];
  const selectedPathTokens = useMemo(() => showAll ? [] : new URLSearchParams(search).get("path")?.split("~").filter(Boolean) ?? [], [search, showAll]);
  const selectedPath = useMemo(() => showAll ? [] : categoryLabelsFromTokens(category?.subcategories ?? [], selectedPathTokens), [category?.subcategories, selectedPathTokens, showAll]);
  const selectedPathLabel = selectedPath.join(" › ");
  const [sort, setSort] = useState("relevance");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const allBrands = en ? "All brands" : "Всички марки";
  const [selectedBrand, setSelectedBrand] = useState("Всички марки");
  const [manufacturerQuery, setManufacturerQuery] = useState("");
  const [query, setQuery] = useState("");
  const [inStock, setInStock] = useState(false);
  const [enquiry, setEnquiry] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("");
  const resetFilters = () => { setSelectedBrand("Всички марки"); setManufacturerQuery(""); setQuery(""); setInStock(false); setEnquiry(false); setMinPrice(""); setMaxPrice(""); setSort("relevance"); setPage(1); };

  useEffect(() => { resetFilters(); setFiltersOpen(false); setPage(1); }, [category?.slug, selectedPathLabel, showAll]);
  useEffect(() => {
    if (showAll || !category || selectedPath.length === 0) return;
    const canonicalPath = categoryPathTokens(selectedPath).join("~");
    if (selectedPathTokens.join("~") !== canonicalPath) setLocation(pathLink(category.slug, selectedPath), { replace: true });
  }, [category, selectedPath, selectedPathTokens, setLocation, showAll]);

  const pageSize = 48;
  const catalogueInput = useMemo(() => ({
    page,
    pageSize,
    categorySlug: showAll ? undefined : category?.slug,
    path: selectedPathTokens.length ? selectedPathTokens : undefined,
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
  const visiblePages = useMemo(() => paginationItems(totalPages, currentPage), [currentPage, totalPages]);
  const pageProducts = cataloguePage.products;
  const goToPage = (target: number) => {
    const next = Math.max(1, Math.min(totalPages, Math.floor(target) || 1));
    setPage(next);
    setPageInput("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const navigateToCatalogue = (href: string) => { setPage(1); setFiltersOpen(false); setLocation(href); };
  const selectSubcategory = (path: string[]) => navigateToCatalogue(pathLink(category.slug, path));
  const title = showAll ? (en ? "All products" : "Всички продукти") : category.label;
  const description = showAll ? (en ? "Joan’s full catalogue — filter by manufacturer, availability, price and name." : "Пълният каталог на Жоан — филтрирайте по производител, наличност, цена и име.") : category.description;
  const listingTitle = selectedPathLabel ? `${en ? "Products in" : "Продукти в"} ${selectedPathLabel}` : showAll ? (en ? "All available products" : "Всички налични продукти") : `${en ? "Products in" : "Продукти в"} ${category.label}`;

  return (
    <Layout>
      <PageMeta title={title} description={description} canonicalUrl={typeof window === "undefined" ? undefined : `${window.location.origin}${showAll ? "/products" : `/category/${category.slug}`}`} metaRobots="index,follow" />
      <JsonLd />
      <main>
        <div className="page-frame category-shell">
          <Breadcrumbs items={showAll ? [{ label: en ? "All products" : "Всички продукти" }] : [{ label: category.label }]} />
          {showAll ? (
            <section className="all-products-hero">
              <p className="eyebrow">{en ? "Full catalogue" : "Пълен каталог"}</p><h1>{en ? "All products" : "Всички продукти"}</h1><p>{en ? "Browse all published products or go to a specific category and subcategory." : "Разгледайте всички публикувани артикули или преминете към конкретна категория и подкатегория."}</p>
              <div>{categories.map((item) => <Link key={item.slug} href={`/category/${item.slug}`}><CategoryIcon icon={item.icon} size={16} /> {item.label}</Link>)}</div>
            </section>
          ) : (
            <>
              <section className="category-hero">
                <img src={category.image} alt={`${category.label} — ${category.description}`} /><div className="category-hero-overlay" />
                <div className="category-hero-content">
                  <p className="eyebrow">Каталог Жоан</p><h1>{category.label}</h1><p>{category.description}</p>
                  {selectedPathLabel && <div className="category-hero-path"><span>{selectedPath.join(" / ")}</span><button type="button" onClick={() => selectSubcategory([])}>Всички в {category.label}</button></div>}
                </div>
              </section>
              {!selectedPathLabel && <CategoryHierarchy category={category} selectedPath={selectedPathLabel} onSelect={selectSubcategory} />}
            </>
          )}
          <div className="category-content-row">
            <aside className={`filter-panel ${filtersOpen ? "is-open" : ""}`} aria-label={en ? "Filters" : "Филтри"}>
              <div className="filter-heading"><b>{en ? "Filters" : "Филтри"}</b><button type="button" onClick={() => setFiltersOpen(false)}>{en ? "Close" : "Затвори"}</button></div>
              <label className="filter-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={showAll ? (en ? "Search all products" : "Търсете във всички продукти") : (en ? "Search this category" : "Търсете в категорията")} /></label>
              <details className="manufacturer-filter">
                <summary>{en ? "Manufacturer" : "Производител"} <ChevronDown size={16} /></summary>
                <div className="manufacturer-filter-content">
                  <label className="manufacturer-filter-search"><Search size={14} /><span className="sr-only">{en ? "Search manufacturer" : "Търсене на производител"}</span><input value={manufacturerQuery} onChange={(event) => setManufacturerQuery(event.target.value)} placeholder={en ? "Search manufacturer" : "Търсене на производител"} /></label>
                  <div className="filter-options">{matchingBrands.map((brand) => <label key={brand}><input type="radio" value={brand} checked={selectedBrand === brand} onChange={() => { setSelectedBrand(brand); setPage(1); }} /> <span>{brand === "Всички марки" ? (en ? "All manufacturers" : "Всички производители") : brand}</span></label>)}</div>
                  {matchingBrands.length === 1 && normalizedManufacturerQuery ? <p className="manufacturer-empty">{en ? "No manufacturer found." : "Няма намерен производител."}</p> : null}
                </div>
              </details>
              <details open><summary>{en ? "Availability" : "Наличност"} <ChevronDown size={16} /></summary><div className="filter-options muted-options"><label><input type="checkbox" checked={inStock} onChange={(event) => setInStock(event.target.checked)} /> <span>{en ? "In stock" : "На склад"}</span></label><label><input type="checkbox" checked={enquiry} onChange={(event) => setEnquiry(event.target.checked)} /> <span>{en ? "On request" : "По запитване"}</span></label></div></details>
              <details open><summary>{en ? "Price (€)" : "Цена (€)"} <ChevronDown size={16} /></summary><div className="filter-price-range"><input value={minPrice} min="0" onChange={(event) => setMinPrice(event.target.value)} type="number" inputMode="decimal" placeholder={en ? "From" : "От"} /><input value={maxPrice} min="0" onChange={(event) => setMaxPrice(event.target.value)} type="number" inputMode="decimal" placeholder={en ? "To" : "До"} /></div></details>
              <button type="button" className="filter-reset" onClick={resetFilters}><RotateCcw size={14} /> {en ? "Clear filters" : "Изчисти филтрите"}</button>
            </aside>
            <section className={`listing-content ${selectedPathLabel ? "is-selected-subcategory" : ""}`}>
              {!selectedPathLabel && <div className="listing-heading"><div><p className="eyebrow">{showAll ? (en ? "Full catalogue" : "Пълен каталог") : (en ? "Selected products" : "Подбрани продукти")}</p><h2>{listingTitle}</h2><p>{en ? "Search, filter and sort catalogue products by manufacturer, availability and price." : "Търсете, филтрирайте и подредете каталожните артикули по производител, наличност и цена."}</p></div><button type="button" className="mobile-filter" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={18} /> {en ? "Filters" : "Филтри"}</button></div>}
              <div className="listing-tools">
                {selectedPathLabel && <button type="button" className="mobile-filter selected-path-filter" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={18} /> {en ? "Filters" : "Филтри"}</button>}
                <span><Grid2X2 size={17} /> <b>{cataloguePage.total}</b> {en ? "products" : "продукта"}</span>
                <label>{en ? "Sort" : "Сортиране"} <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="relevance">{en ? "Relevance" : "По актуалност"}</option><option value="price-asc">{en ? "Price: low to high" : "Цена: ниска към висока"}</option><option value="price-desc">{en ? "Price: high to low" : "Цена: висока към ниска"}</option><option value="name-asc">{en ? "Name: A – Z" : "Име: А – Я"}</option><option value="name-desc">{en ? "Name: Z – A" : "Име: Я – А"}</option></select></label>
              </div>
              {cataloguePage.isLoading ? <div className="empty-products"><ListFilter size={26} /><h3>{en ? "Loading products…" : "Зареждане на продукти…"}</h3><p>{en ? "Loading results only for the selected category." : "Извличаме само резултатите за избраната категория."}</p></div> : pageProducts.length ? (
                <div className="catalogue-workbench"><div className="product-grid listing-grid">{pageProducts.map((product) => <ProductCard key={product.slug} product={product} />)}</div>{totalPages > 1 && <nav className="catalogue-pagination" aria-label={en ? "Product pages" : "Страници с продукти"}><button type="button" className="pagination-step" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>{en ? "Previous" : "Предишна"}</button><div className="pagination-page-list" aria-label={en ? "Page numbers" : "Номера на страници"}>{visiblePages.map((item, index) => item === "ellipsis" ? <span key={`ellipsis-${index}`} className="pagination-ellipsis" aria-hidden="true">…</span> : <button type="button" key={item} className={`pagination-page-number ${item === currentPage ? "is-current" : ""}`} onClick={() => goToPage(item)} aria-current={item === currentPage ? "page" : undefined} aria-label={`${en ? "Page" : "Страница"} ${item}`}>{item}</button>)}</div><form className="pagination-jump" onSubmit={(event) => { event.preventDefault(); goToPage(Number(pageInput)); }}><label htmlFor="catalogue-page-jump">{en ? "Go to page" : "Към страница"}</label><input id="catalogue-page-jump" type="number" inputMode="numeric" min="1" max={totalPages} value={pageInput} onChange={(event) => setPageInput(event.target.value)} placeholder={String(totalPages)} /><button type="submit">{en ? "Go" : "Към"}</button></form><span className="pagination-status">{en ? "Page" : "Страница"} <b>{currentPage}</b> {en ? "of" : "от"} {totalPages}</span><button type="button" className="pagination-step" disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)}>{en ? "Next" : "Следваща"}</button></nav>}</div>
              ) : <div className="empty-products"><ListFilter size={26} /><h3>{en ? "No products for the selected filter." : "Няма продукти за избрания филтър."}</h3><p>{en ? "Clear active filters, change the search, or return to a higher category." : "Изчистете активните филтри, променете търсенето или се върнете към по-горна категория."}</p><button type="button" className="filter-reset" onClick={resetFilters}><RotateCcw size={14} /> {en ? "Show all" : "Покажи всички"}</button></div>}
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
