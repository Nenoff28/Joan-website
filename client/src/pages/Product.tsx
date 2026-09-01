/** DESIGN REMINDER — Product truth comes first: complete image, price/inquiry state, manufacturer identity and useful catalogue alternatives. */
import { Breadcrumbs, JsonLd, Layout, PageMeta, ProductCard, SectionHeading } from "@/components/Storefront";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useCart } from "@/contexts/CartContext";
import { useCatalogue, useCatalogueProduct } from "@/hooks/useCatalogue";
import { Check, ChevronLeft, ChevronRight, Heart, MessageSquareText, Minus, Plus, Scale, ShieldCheck, ShoppingCart, Truck, X, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";
import "./productLogoContrast.css";
import "./productTechnicalSpecs.css";

const lightWordmarkBrands = new Set(["Ceresit", "FAYANS", "GRONE", "Legrand", "SPIRIT", "Vormann", "Zvezda"]);

export default function Product() {
  const { language, t } = useLanguage();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addItem } = useCart();
  const [, params] = useRoute("/product/:slug");
  const [, setLocation] = useLocation();
  const { categories } = useCatalogue();
  const { product, related, isLoading } = useCatalogueProduct(params?.slug);
  const category = categories.find((item) => item.slug === product?.category);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [relatedStart, setRelatedStart] = useState(0);
  const [failedBrandLogo, setFailedBrandLogo] = useState<string>();
  const activeImage = product?.gallery[selectedImage] ?? product?.image;
  const favorite = product ? isFavorite(product.slug) : false;
  const priceLabel = product?.oldPrice ? t("promotionalPrice") : language === "bg" ? "Цена" : "Price";
  const isOutOfStock = product?.availabilityCode === "out_of_stock";
  const availabilityLabel = !product ? "" : language === "en" ? product.availabilityCode === "in_stock" ? "In stock" : product.availabilityCode === "out_of_stock" ? "Out of stock" : "On request" : product.availability;

  useEffect(() => {
    setSelectedImage(0);
    setIsZoomed(false);
    setRelatedStart(0);
    setFailedBrandLogo(undefined);
  }, [product?.slug]);
  useEffect(() => {
    if (product && params?.slug && product.slug !== params.slug) setLocation(`/product/${product.slug}`, { replace: true });
  }, [params?.slug, product?.slug, setLocation]);

  if (!product) return <Layout><PageMeta title={language === "en" ? "Product" : "Продукт"} description={language === "en" ? "View a product from Joan's catalogue." : "Преглед на продукт от каталога на Жоан."} /><main className="product-page"><div className="page-frame"><section className="empty-products"><h1>{isLoading ? (language === "en" ? "Loading product…" : "Зареждане на продукта…") : (language === "en" ? "Product not found." : "Продуктът не е намерен.")}</h1><p>{isLoading ? (language === "en" ? "We are retrieving only the selected product." : "Извличаме само избрания продукт.") : (language === "en" ? "The item may be discontinued or the address may be invalid." : "Артикулът може да е спрян или адресът да е невалиден.")}</p><Link href="/products" className="filter-reset">{language === "en" ? "All products" : "Към всички продукти"}</Link></section></div></main></Layout>;

  const carouselSize = Math.min(4, related.length);
  const carouselProducts = carouselSize ? Array.from({ length: carouselSize }, (_, offset) => related[(relatedStart + offset) % related.length]) : [];
  const rotateRecommendations = (direction: 1 | -1) => setRelatedStart((current) => related.length ? (current + direction + related.length) % related.length : 0);
  const productBrand = product.brand || "ЖОАН";
  const technicalSpecs = product.technicalSpecs?.length ? product.technicalSpecs : product.features.map((value) => ({ label: t("characteristic"), value }));

  return <Layout>
    <PageMeta title={product.metaTitle || product.name} description={product.metaDescription || product.description} canonicalUrl={typeof window === "undefined" ? undefined : `${window.location.origin}/product/${product.slug}`} metaRobots={product.metaRobots || "index,follow"} ogImage={product.image} ogImageAlt={product.imageAlt || product.name} />
    <JsonLd product={product} />
    <main className="product-page">
      <div className="page-frame">
        <Breadcrumbs items={[{ label: category?.label || (language === "en" ? "Catalogue" : "Каталог"), href: `/category/${product.category}` }, { label: product.name }]} />
        <section className="product-detail">
          <div className="product-gallery" style={{ background: "#ffffff" }}>
            <div className="gallery-accent">{product.discount ? `${t("promo")} ${product.discount}` : availabilityLabel}</div>
            <button type="button" className="gallery-stage" onClick={() => setIsZoomed(true)} aria-label={language === "en" ? "Zoom product image" : "Приближете снимката на продукта"}><img src={activeImage} alt={product.imageAlt || product.name} /><span><ZoomIn size={16} /> {language === "en" ? "Zoom" : "Приближи"}</span></button>
            <div className="gallery-thumbs" aria-label={language === "en" ? "Product gallery" : "Галерия на продукта"}>{product.gallery.map((image, index) => <button type="button" key={`${image}-${index}`} onClick={() => setSelectedImage(index)} className={selectedImage === index ? "is-active" : ""} aria-label={language === "en" ? `Image ${index + 1} of ${product.gallery.length}` : `Снимка ${index + 1} от ${product.gallery.length}`} aria-pressed={selectedImage === index}><img src={image} alt={`${product.name} — ${language === "en" ? `image ${index + 1}` : `снимка ${index + 1}`}`} /><span>{String(index + 1).padStart(2, "0")}</span></button>)}</div>
          </div>
          <div className="product-detail-info">
            <div className={`product-brand-logo-wrap${lightWordmarkBrands.has(productBrand) ? " is-light-wordmark" : ""}`}>{product.brandLogo && failedBrandLogo !== product.brandLogo ? <img className="product-brand-logo" src={product.brandLogo} alt="" onError={() => setFailedBrandLogo(product.brandLogo)} /> : <p className="product-brand">{productBrand}</p>}<span className="sr-only">{language === "en" ? `Brand: ${productBrand}` : `Марка: ${productBrand}`}</span></div>
            <h1>{product.name}</h1>
            <div className={`detail-status detail-status-${product.availabilityCode ?? "on_request"}`}><span />{availabilityLabel}</div>
            <div className="product-spec-pills">{product.features.map((feature) => <span key={feature}><Check size={14} /> {feature}</span>)}</div>
            <div className="operational-spec-strip"><span><b>{t("availableInfo")}</b>{availabilityLabel}</span><span><b>{t("category")}</b>{category?.label}</span><span><b>{t("delivery")}</b>{t("deliveryAfterConfirmation")}</span></div>
            <div className="detail-price-box">{product.price ? <div><p>{priceLabel}</p><strong>{product.price}</strong>{product.oldPrice && <span>{product.oldPrice}</span>}</div> : <div><p>{t("priceAvailability")}</p><strong className="ask-price">{t("enquiry")}</strong><span>{t("teamWillConfirm")}</span></div>}</div>
            <div className="buy-controls">{!isOutOfStock && <div className="quantity-control"><button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label={language === "en" ? "Decrease quantity" : "Намали количеството"}><Minus size={16} /></button><span>{quantity}</span><button type="button" onClick={() => setQuantity(quantity + 1)} aria-label={language === "en" ? "Increase quantity" : "Увеличи количеството"}><Plus size={16} /></button></div>}{product.price && !isOutOfStock ? <button type="button" className="inquiry-button" onClick={() => { addItem(product.slug, quantity); toast(t("cart") === "Количка" ? "Артикулът е добавен в количката." : "Item added to cart."); }}><ShoppingCart size={18} /> {t("cart")}</button> : <Link href="/contact" className="inquiry-button">{t("productEnquiry")} <ChevronRight size={18} /></Link>}<button type="button" className={`secondary-icon ${favorite ? "is-favorite" : ""}`} aria-label={t("favorites")} aria-pressed={favorite} onClick={() => { toggleFavorite(product.slug); toast(favorite ? t("removedFromFavorites") : t("addedToFavorites")); }}><Heart size={19} fill={favorite ? "currentColor" : "none"} /></button><button type="button" className="secondary-icon" aria-label={language === "en" ? "Compare product" : "Сравни продукта"} onClick={() => toast(language === "en" ? "Compare" : "Сравнение")}><Scale size={19} /></button></div>
            <div className="detail-assurances"><p><Truck size={18} /><span><b>{t("deliveryAfterConfirmation")}</b>{t("deliveryDetails")}</span></p><p><ShieldCheck size={18} /><span><b>{t("exactTeamInfo")}</b>{t("exactTeamInfoDetail")}</span></p></div>
          </div>
        </section>
        <section className={`product-information${product.description ? "" : " product-information-specs-only"}`}>{product.description ? <div><p className="eyebrow">{t("description")}</p><h2>{t("aboutProduct")}</h2><p>{product.description}</p></div> : null}<div className="spec-table"><p className="eyebrow">{t("availableInfo")}</p><h2>{t("technicalData")}</h2>{technicalSpecs.map((specification, index) => <div className={`specification-row ${index % 2 === 0 ? "is-muted" : ""}`} key={`${specification.label}-${specification.value}`}><span>{specification.label}</span><b>{specification.value}</b></div>)}<div className="specification-row"><span>{t("category")}</span><Link href={`/category/${product.category}`}>{category?.label}</Link></div></div></section>
        <section className="reviews-section"><SectionHeading eyebrow={t("reviewsEyebrow")} title={t("reviewsTitle")} text={t("verifiedFeedback")} /><div className="reviews-empty-state"><div className="review-state-icon"><MessageSquareText size={25} /></div><div><p className="eyebrow">{t("verifiedFeedback")}</p><h3>{t("noReviews")}</h3><p>{t("noReviewsDetail")}</p><button type="button" onClick={() => toast(t("reviewActionToast"))}>{t("reviewAction")} <ChevronRight size={16} /></button></div></div></section>
        <section className="related-section"><SectionHeading eyebrow={t("catalogue")} title={t("recommendations")} text={t("recommendationsText")} /><div className="related-carousel"><div className="related-carousel-track" aria-live="polite">{carouselProducts.map((item) => <ProductCard key={item.slug} product={item} compact />)}</div>{related.length > 4 && <div className="related-carousel-controls"><button type="button" onClick={() => rotateRecommendations(-1)} aria-label={language === "en" ? "Show previous recommendations" : "Покажи предишни препоръчани продукти"}><ChevronLeft size={18} /></button><span>{language === "en" ? `Showing ${relatedStart + 1}–${Math.min(relatedStart + 4, related.length)} of ${related.length}` : `Показани ${relatedStart + 1}–${Math.min(relatedStart + 4, related.length)} от ${related.length}`}</span><button type="button" onClick={() => rotateRecommendations(1)} aria-label={language === "en" ? "Show next recommendations" : "Покажи следващи препоръчани продукти"}><ChevronRight size={18} /></button></div>}</div></section>
      </div>
      {isZoomed && <div className="image-zoom-modal" role="dialog" aria-modal="true" aria-label={language === "en" ? "Zoomed product view" : "Приближен изглед на продукта"} onClick={() => setIsZoomed(false)}><button type="button" className="image-zoom-close" onClick={() => setIsZoomed(false)} aria-label={language === "en" ? "Close zoomed view" : "Затвори приближения изглед"}><X size={20} /></button><img src={activeImage} alt={product.imageAlt || product.name} onClick={(event) => event.stopPropagation()} /></div>}
    </main>
  </Layout>;
}
