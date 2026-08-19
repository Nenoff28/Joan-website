/** DESIGN REMINDER — Red Workshop Modernism: product truth comes first—image, price/inquiry state, availability, and verifiable specifications. */
import { Breadcrumbs, JsonLd, Layout, PageMeta, ProductCard, SectionHeading } from "@/components/Storefront";
import { categories, products } from "@/lib/storeData";
import { Check, ChevronRight, Heart, Minus, Plus, Scale, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";

export default function Product() {
  const [, params] = useRoute("/product/:slug");
  const product = products.find((item) => item.slug === params?.slug) ?? products[0];
  const category = categories.find((item) => item.slug === product.category);
  const [quantity, setQuantity] = useState(1);
  const related = products.filter((item) => item.slug !== product.slug).slice(0, 3);
  return <Layout>
    <PageMeta title={product.name} description={product.description} />
    <JsonLd product={product} />
    <main className="product-page">
      <div className="page-frame">
        <Breadcrumbs items={[{ label: category?.label || "Каталог", href: `/category/${product.category}` }, { label: product.name }]} />
        <section className="product-detail">
          <div className="product-gallery"><div className="gallery-accent">{product.discount ? `ПРОМО ${product.discount}` : "ПРЕДСТАВИТЕЛЕН ПРОДУКТ"}</div><img src={product.image} alt={product.imageAlt} /><div className="gallery-thumb"><img src={product.image} alt="" /><span>1</span></div></div>
          <div className="product-detail-info"><p className="product-brand">{product.brand}</p><h1>{product.name}</h1><div className="detail-status"><span />{product.availability}</div><p className="detail-summary">{product.description}</p><div className="product-spec-pills">{product.features.map((feature) => <span key={feature}><Check size={14} /> {feature}</span>)}</div><div className="detail-price-box">{product.price ? <><div><p>Промоционална цена</p><strong>{product.price} <small>{product.priceBgn}</small></strong><span>{product.oldPrice} <small>{product.oldPriceBgn}</small></span></div></> : <div><p>Цена и наличност</p><strong className="ask-price">По запитване</strong><span>Екипът ще потвърди актуалната информация.</span></div>}</div><div className="buy-controls"><div className="quantity-control"><button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Намали количество"><Minus size={16} /></button><span>{quantity}</span><button type="button" onClick={() => setQuantity(quantity + 1)} aria-label="Увеличи количество"><Plus size={16} /></button></div><Link href="/contact" className="inquiry-button">Запитване за продукта <ChevronRight size={18} /></Link><button type="button" className="secondary-icon" aria-label="Добави в любими" onClick={() => toast("Добавено в любими") }><Heart size={19} /></button><button type="button" className="secondary-icon" aria-label="Сравни продукта" onClick={() => toast("Продуктът е добавен за сравнение") }><Scale size={19} /></button></div><div className="detail-assurances"><p><Truck size={18} /><span><b>Доставка след потвърждение</b>Условията са описани в страницата за доставка.</span></p><p><ShieldCheck size={18} /><span><b>Точна информация от екипа</b>За наличност и пълни технически данни.</span></p></div></div>
        </section>
        <section className="product-information"><div><p className="eyebrow">Описание</p><h2>За продукта</h2><p>{product.description}</p></div><div className="spec-table"><p className="eyebrow">Налична информация</p><h2>Технически данни</h2>{product.features.map((feature) => <div key={feature}><span>Характеристика</span><b>{feature}</b></div>)}<div><span>Категория</span><Link href={`/category/${product.category}`}>{category?.label}</Link></div></div></section>
        <section className="related-section"><SectionHeading eyebrow="Разгледайте още" title="Подобни продукти" text="Представителни артикули от текущия продуктов каталог на Жоан." /><div className="product-grid related-grid">{related.map((item) => <ProductCard key={item.slug} product={item} compact />)}</div></section>
      </div>
    </main>
  </Layout>;
}
