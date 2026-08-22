/** DESIGN REMINDER — Red Workshop Modernism: Favorites remain a practical saved-materials ledger, not a lifestyle wishlist. */
import { Breadcrumbs, Layout, PageMeta } from "@/components/Storefront";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { useCatalogueProducts } from "@/hooks/useCatalogue";
import { ArrowRight, Heart, ShoppingCart, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Favorites() {
  const { t } = useLanguage();
  const { count, favoriteSlugs, isFavorite, removeFavorite, clearFavorites } = useFavorites();
  const { addItem } = useCart();
  const { products } = useCatalogueProducts(favoriteSlugs);
  const savedProducts = products.filter((product) => isFavorite(product.slug));

  return <Layout>
    <PageMeta title={t("favoritesTitle")} description={t("favoritesLead")} />
    <main className="favorites-page">
      <div className="page-frame">
        <Breadcrumbs items={[{ label: t("favoritesTitle") }]} />
        <section className="favorites-heading">
          <div>
            <p className="eyebrow">{t("favorites")}</p>
            <h1>{t("favoritesTitle")}</h1>
            <p>{t("favoritesLead")}</p>
          </div>
          {count > 0 && <div className="favorites-heading-actions"><span className="favorites-count-chip">{count} {t("savedItems")}</span><button type="button" className="favorites-clear" onClick={clearFavorites}><Trash2 size={16} /> {t("clearFavorites")}</button></div>}
        </section>

        {savedProducts.length === 0 ? (
          <section className="favorites-empty">
            <aside className="favorites-empty-index">
              <span>LIST—00</span>
              <div className="favorites-empty-icon"><Heart size={27} /></div>
              <b>00</b>
              <small>{t("savedItems")}</small>
              <p>{t("catalogue")}</p>
            </aside>
            <div className="favorites-empty-guide">
              <p className="eyebrow">{t("favorites")}</p>
              <h2>{t("favoritesEmptyTitle")}</h2>
              <p>{t("favoritesEmptyText")}</p>
              <div className="favorites-empty-routes" aria-label={t("catalogue")}>
                <span><b>01</b><small>{t("browseCatalogue")}</small></span>
                <span><b>02</b><small>{t("favoritesEmptyText")}</small></span>
              </div>
              <Link href="/category/instrumenti" className="button-solid">{t("browseCatalogue")} <ArrowRight size={18} /></Link>
            </div>
          </section>
        ) : (
          <section className="favorites-grid" aria-label={t("favoritesTitle")}>
            {savedProducts.map((product) => (
              <article className="favorite-product" key={product.slug}>
                <Link href={`/product/${product.slug}`} className="favorite-product-media"><img src={product.image} alt={product.imageAlt} /></Link>
                <div className="favorite-product-copy">
                  <p className="product-brand">{product.brand || "ЖОАН"}</p>
                  <Link href={`/product/${product.slug}`} className="favorite-product-title">{product.name}</Link>
                  <p className="favorite-product-features">{product.features.slice(0, 2).join(" · ")}</p>
                  <div className="favorite-product-bottom">
                    <div className="favorite-product-price">{product.price ? <b>{product.price}</b> : <b className="ask-price">{t("enquiry")}</b>}</div>
                    <div className="favorite-product-actions">
                      <Link href={`/product/${product.slug}`} className="favorite-view">{t("viewProduct")} <ArrowRight size={15} /></Link>
                      {product.price && <button type="button" className="favorite-buy" aria-label={`${t("cart")}: ${product.name}`} onClick={() => { addItem(product.slug); toast(t("cart") === "Количка" ? "Артикулът е добавен в количката." : "Item added to cart."); }}><ShoppingCart size={17} /></button>}
                      <button type="button" className="favorite-remove" onClick={() => removeFavorite(product.slug)} aria-label={`${t("removeFromFavorites")}: ${product.name}`}><Trash2 size={17} /></button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  </Layout>;
}
