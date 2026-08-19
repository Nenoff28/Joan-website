/** DESIGN REMINDER — Red Workshop Modernism: a filterable workbench for fast product discovery, with Joan-red only on active decisions. */
import { Breadcrumbs, CategoryIcon, JsonLd, Layout, PageMeta, ProductCard, SectionHeading } from "@/components/Storefront";
import { categories, products } from "@/lib/storeData";
import { ChevronDown, Grid2X2, ListFilter, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useRoute } from "wouter";

export default function Category() {
  const [, params] = useRoute("/category/:slug");
  const category = categories.find((item) => item.slug === params?.slug) ?? categories[0];
  const [sort, setSort] = useState("relevance");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("Всички марки");
  const categoryProducts = useMemo(() => products.filter((product) => product.category === category.slug), [category.slug]);
  const visibleProducts = useMemo(() => {
    const filtered = selectedBrand === "Всички марки" ? categoryProducts : categoryProducts.filter((item) => item.brand === selectedBrand);
    return [...filtered].sort((left, right) => {
      if (sort === "price") return Number(left.price?.replace("€", "") ?? 0) - Number(right.price?.replace("€", "") ?? 0);
      if (sort === "name") return left.name.localeCompare(right.name, "bg");
      return 0;
    });
  }, [categoryProducts, selectedBrand, sort]);
  const brands = ["Всички марки", ...Array.from(new Set(categoryProducts.map((product) => product.brand).filter((brand): brand is string => Boolean(brand))))];

  return <Layout>
    <PageMeta title={category.label} description={`${category.description} Открийте представителни продукти и категории в ЖОАН.`} />
    <JsonLd />
    <main>
      <div className="page-frame category-shell">
        <Breadcrumbs items={[{ label: category.label }]} />
        <section className="category-hero">
          <img src={category.image} alt="" />
          <div className="category-hero-overlay" />
          <div className="category-hero-content"><p className="eyebrow">Каталог Жоан</p><h1>{category.label}</h1><p>{category.description}</p><div className="category-subchips">{category.subcategories.map((item) => <span key={item}>{item}</span>)}</div></div>
        </section>
        <div className="category-content-row">
          <aside className={`filter-panel ${filtersOpen ? "is-open" : ""}`} aria-label="Филтри">
            <div className="filter-heading"><b>Филтри</b><button type="button" onClick={() => setFiltersOpen(false)}>Затвори</button></div>
            <details open><summary>Марка <ChevronDown size={16} /></summary><div className="filter-options">{brands.map((brand) => <label key={brand}><input type="radio" value={brand} checked={selectedBrand === brand} onChange={() => setSelectedBrand(brand)} /> <span>{brand}</span></label>)}</div></details>
            <details open><summary>Наличност <ChevronDown size={16} /></summary><div className="filter-options muted-options"><label><input type="checkbox" /> <span>С наличност</span></label><label><input type="checkbox" /> <span>По запитване</span></label></div></details>
            <details><summary>Цена <ChevronDown size={16} /></summary><div className="price-skeleton"><span>от</span><span>до</span></div></details>
            <p className="filter-note">Филтрите са демонстрационни и ще се свържат с пълния продуктов каталог при интеграция.</p>
          </aside>
          <section className="listing-content">
            <div className="listing-heading"><div><p className="eyebrow">Подбрани продукти</p><h2>Продукти в {category.label}</h2><p>Представителни актуални артикули и маршрути за откриване в пълния каталог.</p></div><button type="button" className="mobile-filter" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={18} /> Филтри</button></div>
            <div className="listing-tools"><span><Grid2X2 size={17} /> Подреждане</span><label>Сортиране <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevance">По актуалност</option><option value="price">По цена</option><option value="name">По име</option></select></label></div>
            {visibleProducts.length ? <div className="catalogue-workbench"><div className="product-grid listing-grid">{visibleProducts.map((product) => <ProductCard key={product.slug} product={product} />)}</div><aside className="catalogue-density-panel"><div className="catalogue-density-title"><span className="catalogue-rail" /><div><p className="eyebrow">Работна навигация</p><h3>Открийте по вид и задача</h3></div></div><div className="catalogue-subcategory-grid">{category.subcategories.map((item, index) => <button type="button" key={item} onClick={() => setFiltersOpen(true)}><b>0{index + 1}</b><span>{item}</span><ChevronDown size={15} /></button>)}</div><div className="catalogue-density-spec"><span>Каталогова структура</span><b>Марка · Технически данни · Наличност</b></div><p>След свързване с продуктовия каталог, тук ще се покажат всички налични филтри и актуални резултати.</p></aside></div> : <div className="empty-products"><ListFilter size={26} /><h3>Няма продукти за избрания филтър.</h3><p>Изберете друга марка, за да видите представителните продукти.</p></div>}
            <div className="catalogue-note"><CategoryIcon icon={category.icon} size={25} /><p><b>Пълният каталог е по-голям.</b> Страницата е структурирана за бъдещ импорт на всички продукти, спецификации, наличности и филтри за тази категория.</p></div>
          </section>
        </div>
      </div>
    </main>
  </Layout>;
}
