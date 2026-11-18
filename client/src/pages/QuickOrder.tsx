import { Layout, PageMeta, toastAddedToCart } from "@/components/Storefront";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ManagedProduct } from "@/hooks/useCatalogue";
import { publicMediaUrl } from "@/lib/media";
import { displayPrice } from "@/lib/price";
import { parseQuickOrder, type QuickOrderLine } from "@/lib/quickOrder";
import { trpc } from "@/lib/trpc";
import { ShoppingCart } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";

type Match = QuickOrderLine & { product?: ManagedProduct };
const MAX_LINES = 40;

export default function QuickOrder() {
  const { language } = useLanguage();
  const en = language === "en";
  const utils = trpc.useUtils();
  const { addItem } = useCart();
  const [, setLocation] = useLocation();
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function lookUp(event: FormEvent) {
    event.preventDefault();
    const lines = parseQuickOrder(text);
    setError("");
    if (!lines.length) { setMatches(null); setError(en ? "Enter at least one model code." : "Въведете поне един код."); return; }
    if (lines.length > MAX_LINES) { setError(en ? `Up to ${MAX_LINES} codes at a time.` : `До ${MAX_LINES} кода наведнъж.`); return; }
    setLoading(true);
    try {
      const found = await Promise.all(lines.map(async (line) => {
        const page = await utils.catalogue.page.fetch({ page: 1, pageSize: 5, query: line.code, sort: "relevance", language });
        const product = (page.products as ManagedProduct[]).find((item) => item.sku?.trim().toLowerCase() === line.code.toLowerCase());
        return { ...line, product };
      }));
      setMatches(found);
    } catch {
      setError(en ? "The catalogue could not be reached. Try again." : "Каталогът не отговори. Опитайте отново.");
    } finally {
      setLoading(false);
    }
  }

  const orderable = (matches ?? []).filter((m) => m.product?.price && m.product.availabilityCode !== "out_of_stock");

  function addAll() {
    for (const m of orderable) addItem(m.product!.slug, m.quantity);
    toastAddedToCart(language, () => setLocation("/checkout"));
  }

  function status(m: Match) {
    if (!m.product) return en ? "Code not found" : "Няма продукт с този код";
    if (!m.product.price) return en ? "Price on request" : "Цена при запитване";
    if (m.product.availabilityCode === "out_of_stock") return en ? "Out of stock" : "Изчерпан";
    return null;
  }

  return (
    <Layout>
      <PageMeta title={en ? "Quick order by code" : "Бърза поръчка по код"} description={en ? "Add several Joan products to the cart by model code." : "Добавете няколко продукта в количката по техния код."} />
      <main className="page-frame quick-order-page">
        <h1>{en ? "Quick order by code" : "Бърза поръчка по код"}</h1>
        <p>{en ? "One model code per line, with an optional quantity: 12829 x10." : "По един код на ред, по желание с количество: 12829 x10. Кодът е „Модел“ на продуктовата карта и в брошурата."}</p>
        <form onSubmit={lookUp} className="quick-order-form">
          <label htmlFor="quick-order-codes">{en ? "Model codes" : "Кодове"}</label>
          <textarea id="quick-order-codes" value={text} onChange={(event) => setText(event.target.value)} rows={8} placeholder={"12829 x10\n118903\n114894 x 3"} spellCheck={false} />
          {error && <p className="field-error" role="alert">{error}</p>}
          <button type="submit" className="button-solid" disabled={loading}>{loading ? (en ? "Checking…" : "Проверка…") : (en ? "Find products" : "Намери продуктите")}</button>
        </form>
        {matches && (
          <section className="quick-order-results" aria-live="polite">
            <h2>{en ? "Results" : "Резултат"}: {orderable.length} / {matches.length}</h2>
            <ul>
              {matches.map((m) => (
                <li key={m.code} className={status(m) ? "is-unavailable" : ""}>
                  {m.product ? <img src={publicMediaUrl(m.product.image)} alt="" /> : <span className="quick-order-missing" aria-hidden="true">?</span>}
                  <div>
                    <b>{m.product?.name ?? m.code}</b>
                    <small>{en ? "Model" : "Модел"}: {m.code} · {en ? "Qty" : "Кол."}: {m.quantity}</small>
                    {status(m) && <small className="quick-order-status">{status(m)}</small>}
                  </div>
                  <strong>{m.product?.price ? displayPrice(m.product.price) : ""}</strong>
                </li>
              ))}
            </ul>
            <button type="button" className="button-solid" onClick={addAll} disabled={!orderable.length}><ShoppingCart size={18} /> {en ? `Add ${orderable.length} to cart` : `Добави ${orderable.length} в количката`}</button>
          </section>
        )}
      </main>
    </Layout>
  );
}
