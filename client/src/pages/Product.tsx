/** DESIGN REMINDER — Red Workshop Modernism: product truth comes first—image, price/inquiry state, availability, and verifiable specifications. */
import { Breadcrumbs, JsonLd, Layout, PageMeta, ProductCard, SectionHeading } from "@/components/Storefront";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useCart } from "@/contexts/CartContext";
import { useCatalogue, useCatalogueProduct } from "@/hooks/useCatalogue";
import { Check, ChevronRight, Heart, MessageSquareText, Minus, Plus, Scale, ShieldCheck, ShoppingCart, Truck, X, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";

export default function Product() {
  const { language, t } = useLanguage();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addItem } = useCart();
  const [, params] = useRoute("/product/:slug");
  const { categories } = useCatalogue();
  const { product, related, isLoading } = useCatalogueProduct(params?.slug);
  const category = categories.find((item) => item.slug === product?.category);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const activeImage = product?.gallery[selectedImage] ?? product?.image;
  const favorite = product ? isFavorite(product.slug) : false;
  const priceLabel = product?.oldPrice ? t("promotionalPrice") : language === "bg" ? "Цена" : "Price";

  useEffect(() => { setSelectedImage(0); setIsZoomed(false); }, [product?.slug]);

  if (!product) return <Layout><PageMeta title="Продукт" description="Преглед на продукт от каталога на Жоан." /><main className="product-page"><div className="page-frame"><section className="empty-products"><h1>{isLoading ? "Зареждане на продукта…" : "Продуктът не е намерен."}</h1><p>{isLoading ? "Извличаме само избрания продукт." : "Артикулът може да е спрян или адресът да не е валиден."}</p><Link href="/products" className="filter-reset">Към всички продукти</Link></section></div></main></Layout>;

  return <Layout>
    <PageMeta title={product.metaTitle || product.name} description={product.metaDescription || product.description} canonicalUrl={product.canonicalUrl} metaRobots={product.metaRobots} />
    <JsonLd product={product} />
    <main className="product-page">
      <div className="page-frame">
        <Breadcrumbs items={[{ label: category?.label || "Каталог", href: `/category/${product.category}` }, { label: product.name }]} />
        <section className="product-detail">
          <div className="product-gallery"><div className="gallery-accent">{product.discount ? `${t("promo")} ${product.discount}` : product.availability}</div><button type="button" className="gallery-stage" onClick={() => setIsZoomed(true)} aria-label="Приближете снимката на продукта"><img src={activeImage} alt={product.imageAlt} /><span><ZoomIn size={16} /> Приближи</span></button><div className="gallery-thumbs" aria-label="Галерия на продукта">{product.gallery.map((image, index) => <button type="button" key={`${image}-${index}`} onClick={() => setSelectedImage(index)} className={selectedImage === index ? "is-active" : ""} aria-label={`Снимка ${index + 1} от ${product.gallery.length}`} aria-pressed={selectedImage === index}><img src={image} alt="" /><span>{String(index + 1).padStart(2, "0")}</span></button>)}</div></div>
          <div className="product-detail-info"><p className="product-brand">{product.brand}</p><h1>{product.name}</h1><div className="detail-status"><span />{product.availability}</div><p className="detail-summary">{product.description}</p><div className="product-spec-pills">{product.features.map((feature) => <span key={feature}><Check size={14} /> {feature}</span>)}</div><div className="operational-spec-strip"><span><b>{t("availableInfo")}</b>{product.availability}</span><span><b>{t("category")}</b>{category?.label}</span><span><b>{t("delivery")}</b>{t("deliveryAfterConfirmation")}</span></div><div className="detail-price-box">{product.price ? <><div><p>{priceLabel}</p><strong>{product.price}</strong>{product.oldPrice && <span>{product.oldPrice}</span>}</div></> : <div><p>{t("priceAvailability")}</p><strong className="ask-price">{t("enquiry")}</strong><span>{t("teamWillConfirm")}</span></div>}</div><div className="buy-controls"><div className="quantity-control"><button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity"><Minus size={16} /></button><span>{quantity}</span><button type="button" onClick={() => setQuantity(quantity + 1)} aria-label="Increase quantity"><Plus size={16} /></button></div>{product.price ? <button type="button" className="inquiry-button" onClick={() => { addItem(product.slug, quantity); toast(t("cart") === "Количка" ? "Артикулът е добавен в количката." : "Item added to cart."); }}><ShoppingCart size={18} /> {t("cart")}</button> : <Link href="/contact" className="inquiry-button">{t("productEnquiry")} <ChevronRight size={18} /></Link>}<button type="button" className={`secondary-icon ${favorite ? "is-favorite" : ""}`} aria-label={t("favorites")} aria-pressed={favorite} onClick={() => { toggleFavorite(product.slug); toast(favorite ? t("removedFromFavorites") : t("addedToFavorites")); }}><Heart size={19} fill={favorite ? "currentColor" : "none"} /></button><button type="button" className="secondary-icon" aria-label="Compare product" onClick={() => toast("Compare") }><Scale size={19} /></button></div><div className="detail-assurances"><p><Truck size={18} /><span><b>{t("deliveryAfterConfirmation")}</b>{t("deliveryDetails")}</span></p><p><ShieldCheck size={18} /><span><b>{t("exactTeamInfo")}</b>{t("exactTeamInfoDetail")}</span></p></div></div>
        </section>
        <section className="product-information"><div><p className="eyebrow">{t("description")}</p><h2>{t("aboutProduct")}</h2><p>{product.description}</p></div><div className="spec-table"><p className="eyebrow">{t("availableInfo")}</p><h2>{t("technicalData")}</h2>{product.features.map((feature) => <div key={feature}><span>{t("characteristic")}</span><b>{feature}</b></div>)}<div><span>{t("category")}</span><Link href={`/category/${product.category}`}>{category?.label}</Link></div></div></section>
        <section className="reviews-section"><SectionHeading eyebrow={t("reviewsEyebrow")} title={t("reviewsTitle")} text={t("verifiedFeedback")} /><div className="reviews-empty-state"><div className="review-state-icon"><MessageSquareText size={25} /></div><div><p className="eyebrow">{t("verifiedFeedback")}</p><h3>{t("noReviews")}</h3><p>{t("noReviewsDetail")}</p><button type="button" onClick={() => toast(t("reviewActionToast"))}>{t("reviewAction")} <ChevronRight size={16} /></button></div></div></section>
        <section className="related-section"><SectionHeading eyebrow={t("catalogue")} title={t("recommendations")} text={t("recommendationsText")} /><div className="product-grid related-grid">{related.map((item) => <ProductCard key={item.slug} product={item} compact />)}</div></section>
      </div>
      {isZoomed && <div className="image-zoom-modal" role="dialog" aria-modal="true" aria-label="Приближен изглед на продукта" onClick={() => setIsZoomed(false)}><button type="button" className="image-zoom-close" onClick={() => setIsZoomed(false)} aria-label="Затвори приближения изглед"><X size={20} /></button><img src={activeImage} alt={product.imageAlt} onClick={(event) => event.stopPropagation()} /></div>}
    </main>
  </Layout>;
}
