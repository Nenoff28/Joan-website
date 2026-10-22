import { trpc } from "@/lib/trpc";
import { CheckSquare, Edit3, Eye, Filter, Save, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Status = "pending" | "generated" | "reviewed" | "published" | "error";
type Confidence = "high" | "low";
type Item = {
  productId: number;
  name: string;
  slug: string;
  sku: string | null;
  brand: string | null;
  imageUrl: string;
  categoryName: string;
  isActive: boolean;
  availability: string;
  stockQuantity: number;
  aiStatus: Status;
  aiDescription: string | null;
  aiFeatures: string | null;
  aiSeoTitle: string | null;
  aiSeoDescription: string | null;
  aiKeywords: string | null;
  aiConfidence: Confidence | null;
  oldDescription: string | null;
  oldFeatures: string;
  oldSeoTitle: string | null;
  oldSeoDescription: string | null;
  oldKeywords: string | null;
};
type Category = { id: number; name: string; count: number };
const labels: Record<Status, string> = { pending: "Чакащ", generated: "Генериран", reviewed: "Прегледан", published: "Публикуван", error: "Грешка" };

export default function AdminManualContent() {
  const [status, setStatus] = useState<Status | "">("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [categorySearch, setCategorySearch] = useState("");
  const [availability, setAvailability] = useState<"all" | "in_stock" | "not_in_stock">("all");
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [sort, setSort] = useState<"confidence-low" | "name-asc" | "name-desc" | "stock-desc" | "updated-desc">("name-asc");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ description: "", features: "", seoTitle: "", seoDescription: "", keywords: "" });
  const input = useMemo(() => ({ status: status || undefined, query: query.trim() || undefined, categoryId: categoryId || undefined, availability, visibility, sort, page, pageSize: 50 }), [status, query, categoryId, availability, visibility, sort, page]);
  const contentQuery = trpc.admin.aiContent.useQuery(input);
  const categoriesQuery = trpc.admin.aiCategories.useQuery({ status: status || undefined, query: query.trim() || undefined, availability, visibility });
  const idsQuery = trpc.admin.aiProductIds.useQuery({ status: status || undefined, query: query.trim() || undefined, categoryId: categoryId || undefined, availability, visibility });
  const utils = trpc.useUtils();
  const saveMutation = trpc.admin.saveAiContent.useMutation();
  const publishMutation = trpc.admin.publishApprovedAiContent.useMutation();
  const items = (contentQuery.data?.items ?? []) as Item[];
  const selected = items.find(item => item.productId === selectedId) ?? null;
  const categories = useMemo(() => {
    const term = categorySearch.trim().toLocaleLowerCase("bg-BG");
    return ((categoriesQuery.data ?? []) as Category[]).filter(item => !term || item.name.toLocaleLowerCase("bg-BG").includes(term));
  }, [categoriesQuery.data, categorySearch]);

  useEffect(() => {
    if (selected) {
      setForm({ description: selected.oldDescription ?? "", features: selected.oldFeatures ?? "", seoTitle: selected.oldSeoTitle ?? "", seoDescription: selected.oldSeoDescription ?? "", keywords: selected.oldKeywords ?? "" });
      setDrawerOpen(true);
    }
  }, [selectedId]);

  const refresh = async () => {
    await Promise.all([utils.admin.aiContent.invalidate(), utils.admin.aiCategories.invalidate(), utils.admin.aiProductIds.invalidate()]);
  };
  const selectProduct = (id: number) => { setSelectedId(id); setDrawerOpen(true); };
  const selectAll = async () => {
    const result = await idsQuery.refetch();
    setSelectedIds(new Set(result.data ?? []));
    toast.success(`Маркирани са ${(result.data ?? []).length} продукта.`);
  };
  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const saveDraft = async () => {
    if (!selected) return;
    try {
      await saveMutation.mutateAsync({ productId: selected.productId, aiStatus: "reviewed", aiDescription: form.description || null, aiFeatures: form.features || null, aiSeoTitle: form.seoTitle || null, aiSeoDescription: form.seoDescription || null, aiKeywords: form.keywords || null, aiSourceUrls: [], aiConfidence: "high", aiError: null });
      await refresh();
      toast.success("Ръчните данни са запазени като прегледани.");
    } catch (error) {
      toast.error(`Запазването не бе изпълнено: ${error instanceof Error ? error.message : "неизвестна грешка"}`);
    }
  };
  const publish = async () => {
    if (!selected) return;
    try {
      await saveMutation.mutateAsync({ productId: selected.productId, aiStatus: "reviewed", aiDescription: form.description || null, aiFeatures: form.features || null, aiSeoTitle: form.seoTitle || null, aiSeoDescription: form.seoDescription || null, aiKeywords: form.keywords || null, aiSourceUrls: [], aiConfidence: "high", aiError: null });
      const result = await publishMutation.mutateAsync({ productIds: [selected.productId] });
      await refresh();
      if (result.published) toast.success("Съдържанието е актуализирано в сайта.");
      else toast.error("Съдържанието не беше публикувано. Провери полетата и опитай отново.");
    } catch (error) {
      toast.error(`Публикуването не бе изпълнено: ${error instanceof Error ? error.message : "неизвестна грешка"}`);
    }
  };

  return <section className="admin-workspace admin-manual-content">
    <div className="admin-page-heading"><div><p className="admin-eyebrow"><Edit3 size={14} /> РЪЧНО СЪДЪРЖАНИЕ · САМО АДМИНИСТРАТОР</p><h1>Ръчно съдържание</h1><p className="admin-panel-caption">Въвеждай и преглеждай описание, технически характеристики и SEO данни без AI генерация.</p></div></div>
    <div className="admin-manual-workflow"><span><b>1</b> Намери продукт</span><span><b>2</b> Въведи и запази</span><span><b>3</b> Актуализирай в сайта</span></div>
    <div className="admin-panel admin-manual-panel">
      <div className="admin-panel-head"><div><h2>Продукти</h2><p>Избери продукт, за да се отвори редакторът отдясно.</p></div><span className="admin-manual-total">Общо: {contentQuery.data?.total ?? 0}</span></div>
      <div className="admin-ai-filter-panel"><div className="admin-ai-filter-heading"><strong><Filter size={15} /> Филтриране и сортиране</strong><span>Комбинирай филтрите за по-бързо намиране.</span></div><div className="admin-ai-filters">
        <label className="admin-search"><Search size={15} /><input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Име, марка или SKU" aria-label="Търсене на продукт" /></label>
        <select value={status} onChange={e => { setStatus(e.target.value as Status | ""); setPage(1); }} aria-label="Филтър по статус"><option value="">Всички статуси</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <label className="admin-ai-category-search"><Search size={14} /><input value={categorySearch} onChange={e => setCategorySearch(e.target.value)} placeholder="Търсене на категория" aria-label="Търсене на категория" /></label>
        <select value={categoryId} onChange={e => { setCategoryId(e.target.value ? Number(e.target.value) : ""); setPage(1); }} aria-label="Филтър по категория"><option value="">Всички категории</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name} ({category.count})</option>)}</select>
        <select value={availability} onChange={e => { setAvailability(e.target.value as typeof availability); setPage(1); }} aria-label="Филтър по наличност"><option value="all">Всички наличности</option><option value="in_stock">Само налични</option><option value="not_in_stock">Без наличност</option></select>
        <select value={visibility} onChange={e => { setVisibility(e.target.value as typeof visibility); setPage(1); }} aria-label="Филтър по видимост"><option value="all">Показани и скрити</option><option value="visible">Показани в сайта</option><option value="hidden">Скрити от сайта</option></select>
        <select value={sort} onChange={e => { setSort(e.target.value as typeof sort); setPage(1); }} aria-label="Сортиране"><option value="name-asc">Име: А → Я</option><option value="name-desc">Име: Я → А</option><option value="confidence-low">Ниска увереност първо</option><option value="stock-desc">Наличност: най-много</option><option value="updated-desc">Последно променени</option></select>
      </div></div>
      <div className="admin-manual-toolbar"><span><CheckSquare size={15} /> Избрани: <strong>{selectedIds.size}</strong></span><button type="button" onClick={selectAll} disabled={idsQuery.isFetching}>{idsQuery.isFetching ? "Зареждане…" : `Маркирай всички (${idsQuery.data?.length ?? "…"})`}</button><button type="button" onClick={() => setSelectedIds(new Set())} disabled={!selectedIds.size}>Изчисти</button></div>
      <div className="admin-manual-list">{contentQuery.isLoading ? <div className="admin-empty-state">Зареждане на продуктите…</div> : items.length === 0 ? <div className="admin-empty-state">Няма продукти с тези филтри.</div> : items.map(item => <article key={item.productId} className={`admin-manual-row${selectedId === item.productId ? " is-selected" : ""}`} onClick={() => selectProduct(item.productId)}>
        <input type="checkbox" checked={selectedIds.has(item.productId)} onChange={e => { e.stopPropagation(); setSelectedIds(current => { const next = new Set(current); e.target.checked ? next.add(item.productId) : next.delete(item.productId); return next; }); }} aria-label={`Избери ${item.name}`} />
        <img src={item.imageUrl} alt="" /><div className="admin-manual-row-main"><strong>{item.name}</strong><small>{item.brand || "Без марка"} · SKU {item.sku || "—"}</small><small>{item.categoryName} · Наличност: {item.stockQuantity} · {item.isActive ? "Показан" : "Скрит"}</small></div><span className={`admin-ai-status admin-ai-status-${item.aiStatus}`}>{labels[item.aiStatus]}</span><button type="button" className="admin-manual-edit-button" onClick={e => { e.stopPropagation(); selectProduct(item.productId); }}><Edit3 size={15} /> Редактирай</button>
      </article>)}</div>
      <div className="admin-manual-pagination"><button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1}>← Предишни</button><span>Страница {page}</span><button type="button" onClick={() => setPage(value => value + 1)} disabled={items.length < 50}>Следващи →</button></div>
    </div>
    {drawerOpen && selected && <div className="admin-manual-drawer-backdrop" onClick={() => setDrawerOpen(false)}><aside className="admin-manual-drawer" onClick={e => e.stopPropagation()}>
      <div className="admin-manual-drawer-head"><div><span className="admin-eyebrow">РЕДАКТОР</span><h2>{selected.name}</h2><small>{selected.brand || "Без марка"} · SKU {selected.sku || "—"}</small></div><button type="button" className="admin-manual-close" onClick={() => setDrawerOpen(false)} aria-label="Затвори редактора"><X size={20} /></button></div>
      <div className="admin-manual-drawer-body"><div className="admin-manual-product-meta"><img src={selected.imageUrl} alt="" /><div><strong>{selected.categoryName}</strong><span>{selected.isActive ? <><Eye size={14} /> Показан в сайта</> : "Скрит от сайта"}</span></div></div>
        <label>Описание<textarea rows={6} value={form.description} onChange={e => update("description", e.target.value)} placeholder="Кратко и ясно описание на продукта…" /></label>
        <label>Технически данни<textarea rows={10} value={form.features} onChange={e => update("features", e.target.value)} placeholder="Един параметър на ред: Номинална мощност: 2 kW" /><small>Пиши по един параметър на ред във формат „Параметър: стойност“.</small></label>
        <label>SEO заглавие<input value={form.seoTitle} onChange={e => update("seoTitle", e.target.value)} maxLength={60} /><small>{form.seoTitle.length}/60 знака</small></label>
        <label>SEO описание<textarea rows={4} value={form.seoDescription} onChange={e => update("seoDescription", e.target.value)} maxLength={200} /><small>{form.seoDescription.length}/200 знака</small></label>
        <label>Ключови думи<textarea rows={3} value={form.keywords} onChange={e => update("keywords", e.target.value)} maxLength={255} /><small>{form.keywords.length}/255 знака</small></label>
      </div><div className="admin-manual-drawer-actions"><a className="admin-manual-view-button" href={`/product/${selected.slug}`} target="_blank" rel="noreferrer"><Eye size={15} /> Виж в сайта</a><button type="button" onClick={saveDraft} disabled={saveMutation.isPending || publishMutation.isPending}><Save size={15} /> {saveMutation.isPending ? "Запазване…" : "Запази ръчните данни"}</button><button type="button" className="admin-primary" onClick={publish} disabled={saveMutation.isPending || publishMutation.isPending}>{publishMutation.isPending ? "Актуализиране…" : "Актуализирай в сайта"}</button></div>
    </aside></div>}
  </section>;
}
