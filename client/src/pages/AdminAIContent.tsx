import { trpc } from "@/lib/trpc";
import { CheckCircle2, CheckSquare, Clock3, FileWarning, Loader2, Pause, Play, Save, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type AiStatus = "pending" | "generated" | "reviewed" | "published" | "error";
type AiConfidence = "high" | "low";

type AiItem = {
  productId: number;
  name: string;
  sku: string | null;
  brand: string | null;
  imageUrl: string;
  categoryName: string;
  oldDescription: string;
  oldFeatures: string;
  oldSeoTitle: string | null;
  oldSeoDescription: string | null;
  oldKeywords: string | null;
  isActive: boolean;
  isArchived: boolean;
  availability: "in_stock" | "on_request" | "out_of_stock";
  stockQuantity: number;
  aiStatus: AiStatus;
  aiProvider: string | null;
  aiModel: string | null;
  aiDescription: string | null;
  aiFeatures: string | null;
  aiSeoTitle: string | null;
  aiSeoDescription: string | null;
  aiKeywords: string | null;
  aiSourceUrls: string[];
  aiConfidence: AiConfidence | null;
  aiError: string | null;
  aiGeneratedAt: Date | string | null;
  aiInputTokens: number | null;
  aiOutputTokens: number | null;
  aiSearchCount: number;
  canRestore: boolean;
};

type AiCategoryOption = { id: number; name: string; count: number };

const statusLabels: Record<AiStatus, string> = {
  pending: "Чакащ",
  generated: "Генериран",
  reviewed: "Прегледан",
  published: "Публикуван",
  error: "Грешка",
};

const confidenceLabels: Record<AiConfidence, string> = { high: "Висока", low: "Ниска" };

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("bg-BG");
}

function statusClass(status: AiStatus) {
  return `admin-ai-status admin-ai-status-${status}`;
}

export default function AdminAIContent() {
  const [status, setStatus] = useState<AiStatus | "">("");
  const [confidence, setConfidence] = useState<AiConfidence | "">("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [categorySearch, setCategorySearch] = useState("");
  const [availability, setAvailability] = useState<"all" | "in_stock" | "not_in_stock">("all");
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [sort, setSort] = useState<"confidence-low" | "name-asc" | "name-desc" | "stock-desc" | "stock-asc" | "updated-desc" | "updated-asc">("confidence-low");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("gemini-3.8-flash");
  const [dailyGenerationLimit, setDailyGenerationLimit] = useState(20);
  const [connectionResults, setConnectionResults] = useState<{ basic?: { ok: boolean; status: number; message: string }; search?: { ok: boolean; status: number; message: string } }>({});
  const [form, setForm] = useState({
    aiStatus: "pending" as AiStatus,
    aiDescription: "",
    aiFeatures: "",
    aiSeoTitle: "",
    aiSeoDescription: "",
    aiKeywords: "",
    aiSourceUrls: "",
    aiConfidence: "" as AiConfidence | "",
    aiError: "",
    aiGeneratedAt: "",
  });
  const input = useMemo(() => ({ status: status || undefined, confidence: confidence || undefined, query: query.trim() || undefined, categoryId: categoryId || undefined, availability, visibility, sort, page, pageSize: 50 }), [status, confidence, query, categoryId, availability, visibility, sort, page]);
  const contentQuery = trpc.admin.aiContent.useQuery(input);
  const settingsQuery = trpc.admin.aiSettings.useQuery();
  const categoriesQuery = trpc.admin.aiCategories.useQuery({ status: status || undefined, confidence: confidence || undefined, query: query.trim() || undefined, availability, visibility });
  const matchingIdsQuery = trpc.admin.aiProductIds.useQuery({ status: status || undefined, confidence: confidence || undefined, query: query.trim() || undefined, categoryId: categoryId || undefined, availability, visibility });
  const queueQuery = trpc.admin.aiQueue.useQuery(undefined, { refetchInterval: 5000 });
  const utils = trpc.useUtils();
  const saveSettingsMutation = trpc.admin.saveAiSettings.useMutation({
    onSuccess: async () => { await utils.admin.aiSettings.invalidate(); },
  });
  const checkGeminiMutation = trpc.admin.checkGeminiConnection.useMutation({
    onSuccess: (result, variables) => setConnectionResults(current => ({ ...current, [variables.withSearch ? "search" : "basic"]: result })),
  });
  const enqueueMutation = trpc.admin.enqueueAiGeneration.useMutation({ onSuccess: async () => { setSelectedIds(new Set()); await queueQuery.refetch(); } });
  const queueStatusMutation = trpc.admin.setAiQueueStatus.useMutation({ onSuccess: async () => { await queueQuery.refetch(); } });
  const saveMutation = trpc.admin.saveAiContent.useMutation({
    onSuccess: async () => {
      await utils.admin.aiContent.invalidate();
    },
  });
  const generateMutation = trpc.admin.generateAiContent.useMutation({
    onSuccess: async () => { await utils.admin.aiContent.invalidate(); },
  });
  const reviewMutation = trpc.admin.reviewAiContent.useMutation({
    onSuccess: async () => { toast.success("Продуктът е одобрен успешно."); await utils.admin.aiContent.invalidate(); await utils.admin.aiCategories.invalidate(); },
  });
  const reviewBatchMutation = trpc.admin.reviewAiContentBatch.useMutation({
    onSuccess: async (result) => { setSelectedIds(new Set()); toast.success(`Одобрени продукти: ${result.reviewed}.`); await utils.admin.aiContent.invalidate(); await utils.admin.aiCategories.invalidate(); },
  });
  const publishMutation = trpc.admin.publishApprovedAiContent.useMutation({
    onSuccess: async () => { setSelectedIds(new Set()); await utils.admin.aiContent.invalidate(); },
  });
  const restoreMutation = trpc.admin.restoreAiBackups.useMutation({
    onSuccess: async () => { setSelectedIds(new Set()); await utils.admin.aiContent.invalidate(); },
  });
  const items = (contentQuery.data?.items ?? []) as AiItem[];
  const selected = items.find(item => item.productId === selectedId) ?? null;

  useEffect(() => {
    if (settingsQuery.data?.systemPrompt && !systemPrompt) setSystemPrompt(settingsQuery.data.systemPrompt);
    if (settingsQuery.data?.model) setModel(settingsQuery.data.model);
    if (settingsQuery.data?.dailyGenerationLimit !== undefined) setDailyGenerationLimit(settingsQuery.data.dailyGenerationLimit);
  }, [settingsQuery.data?.systemPrompt, settingsQuery.data?.model, settingsQuery.data?.dailyGenerationLimit, systemPrompt]);

  useEffect(() => {
    if (!selected && items[0]) setSelectedId(items[0].productId);
  }, [items, selected]);

  useEffect(() => {
    if (!selected) return;
    setForm({
      aiStatus: selected.aiStatus,
      aiDescription: selected.aiDescription ?? "",
      aiFeatures: selected.aiFeatures ?? "",
      aiSeoTitle: selected.aiSeoTitle ?? "",
      aiSeoDescription: selected.aiSeoDescription ?? "",
      aiKeywords: selected.aiKeywords ?? "",
      aiSourceUrls: selected.aiSourceUrls.join("\n"),
      aiConfidence: selected.aiConfidence ?? "",
      aiError: selected.aiError ?? "",
      aiGeneratedAt: selected.aiGeneratedAt ? new Date(selected.aiGeneratedAt).toISOString().slice(0, 16) : "",
    });
  }, [selected]);

  const counts = contentQuery.data?.counts ?? { pending: 0, generated: 0, reviewed: 0, published: 0, error: 0 };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    saveMutation.mutate({
      productId: selected.productId,
      aiStatus: form.aiStatus,
      aiDescription: form.aiDescription || null,
      aiFeatures: form.aiFeatures || null,
      aiSeoTitle: form.aiSeoTitle || null,
      aiSeoDescription: form.aiSeoDescription || null,
      aiKeywords: form.aiKeywords || null,
      aiSourceUrls: form.aiSourceUrls.split(/\r?\n|,/).map(value => value.trim()).filter(Boolean),
      aiConfidence: form.aiConfidence || null,
      aiError: form.aiError || null,
      aiGeneratedAt: form.aiGeneratedAt ? new Date(form.aiGeneratedAt).toISOString() : null,
    });
  };

  const saveSettings = (event: React.FormEvent) => {
    event.preventDefault();
    saveSettingsMutation.mutate({ systemPrompt, model, dailyGenerationLimit });
  };

  const selectAllMatching = async () => {
    const result = await matchingIdsQuery.refetch();
    setSelectedIds(new Set(result.data ?? []));
  };
  const toggleSelected = (productId: number) => setSelectedIds(current => { const next = new Set(current); if (next.has(productId)) next.delete(productId); else next.add(productId); return next; });
  const queue = queueQuery.data;
  const displayValue = (value: string | null | undefined) => value?.trim() || "—";
  const newFeatures = form.aiFeatures.trim() || "—";
  const newSourceUrls = form.aiSourceUrls.split(/\r?\n|,/).map(value => value.trim()).filter(Boolean);
  const selectedApprovedIds = Array.from(selectedIds);
  const selectedRestorableIds = Array.from(selectedIds);
  const currentIndex = selected ? items.findIndex(item => item.productId === selected.productId) : -1;
  const reviewCandidates = selectedIds.size ? items.filter(item => selectedIds.has(item.productId) && item.aiStatus === "generated") : items.filter(item => item.aiStatus === "generated");
  const nextReviewable = currentIndex >= 0 ? reviewCandidates.find(item => items.indexOf(item) > currentIndex) ?? reviewCandidates.find(item => items.indexOf(item) < currentIndex) ?? null : null;
  const filtersBusy = contentQuery.isFetching || categoriesQuery.isFetching || matchingIdsQuery.isFetching;
  const visibleCategories = useMemo(() => {
    const normalized = categorySearch.trim().toLocaleLowerCase("bg-BG");
    return ((categoriesQuery.data ?? []) as AiCategoryOption[]).filter(category => !normalized || category.name.toLocaleLowerCase("bg-BG").includes(normalized));
  }, [categoriesQuery.data, categorySearch]);

  return (
    <section className="admin-workspace">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow"><Sparkles size={14} /> AI СЪДЪРЖАНИЕ · САМО АДМИНИСТРАТОР</p>
          <h1>AI съдържание</h1>
          <p className="admin-panel-caption">Отделен работен слой за AI предложения. Публикуваните данни на продукта не се променят автоматично.</p>
        </div>
      </div>

      <form className="admin-panel admin-ai-settings" onSubmit={saveSettings}>
        <div className="admin-panel-head">
          <div>
            <h2>Системен prompt</h2>
            <p>Този текст се подава като system инструкция при всяко AI генериране. Продуктът се изпраща отделно като марка, име и EAN/артикулен номер.</p>
          </div>
          <button type="submit" className="admin-primary" disabled={saveSettingsMutation.isPending || settingsQuery.isLoading || systemPrompt.trim().length < 20}><Save size={15} /> {saveSettingsMutation.isPending ? "Записване…" : "Запази prompt-а"}</button>
        </div>
        <textarea value={systemPrompt} onChange={event => setSystemPrompt(event.target.value)} rows={12} aria-label="AI системен prompt" placeholder="Въведете системния prompt за AI съдържанието…" />
        <label className="admin-ai-limit-field">Модел<input value={model} onChange={event => setModel(event.target.value)} placeholder="gemini-3.8-flash" aria-label="AI модел" /><small>Моделът се подава към Gemini server-side. Не се задава thinking параметър.</small></label>
        <label className="admin-ai-limit-field">Дневен лимит за генерирания<input type="number" min={0} max={100000} value={dailyGenerationLimit} onChange={event => setDailyGenerationLimit(Math.max(0, Number(event.target.value) || 0))} /><small>0 блокира генерирането; лимитът се прилага за UTC ден.</small></label>
        <div className="admin-ai-connection-checks">
          <strong>Връзка с Gemini</strong>
          <button type="button" onClick={() => checkGeminiMutation.mutate({ model, withSearch: false })} disabled={checkGeminiMutation.isPending}>Провери без търсене</button>
          <button type="button" onClick={() => checkGeminiMutation.mutate({ model, withSearch: true })} disabled={checkGeminiMutation.isPending}>Провери с Google Search</button>
          {connectionResults.basic && <span className={connectionResults.basic.ok ? "admin-ai-check-ok" : "admin-form-error"}>Без търсене — HTTP {connectionResults.basic.status}: {connectionResults.basic.message}</span>}
          {connectionResults.search && <span className={connectionResults.search.ok ? "admin-ai-check-ok" : "admin-form-error"}>С Google Search — HTTP {connectionResults.search.status}: {connectionResults.search.message}</span>}
        </div>
        {saveSettingsMutation.error && <div className="admin-form-error" role="alert">{saveSettingsMutation.error.message}</div>}
        {settingsQuery.error && <div className="admin-form-error" role="alert">Системният prompt не може да се зареди.</div>}
      </form>

      <div className="admin-ai-status-grid" aria-label="Обобщение на AI статусите">
        {(Object.keys(statusLabels) as AiStatus[]).map(key => (
          <button type="button" key={key} className={`admin-ai-status-card ${status === key ? "is-active" : ""}`} onClick={() => { setStatus(status === key ? "" : key); setPage(1); }}>
            <span>{statusLabels[key]}</span><strong>{counts[key]}</strong>
          </button>
        ))}
      </div>

      <div className="admin-panel admin-ai-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Продукти и статус</h2>
            <p>Всички съществуващи продукти започват като „Чакащ“.</p>
          </div>
        </div>
        <div className="admin-ai-filter-panel">
          <div className="admin-ai-filter-heading"><strong>Филтриране и сортиране</strong><span>Комбинирайте филтрите, после маркирайте всички съвпаднали продукти.</span></div>
          {filtersBusy && <div className="admin-ai-filter-loading" role="status" aria-live="polite"><Loader2 size={16} className="animate-spin" /> Прилагам филтрите и обновявам списъка…</div>}
          <div className="admin-ai-filters">
            <label className="admin-search"><Search size={15} /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Име, марка или SKU" aria-label="Търсене в AI съдържанието" /></label>
            <select value={status} onChange={event => { setStatus(event.target.value as AiStatus | ""); setPage(1); }} aria-label="Филтър по AI статус">
              <option value="">Всички AI статуси</option>
              {(Object.keys(statusLabels) as AiStatus[]).map(key => <option key={key} value={key}>{statusLabels[key]}</option>)}
            </select>
            <select value={confidence} onChange={event => { setConfidence(event.target.value as AiConfidence | ""); setPage(1); }} aria-label="Филтър по увереност">
              <option value="">Всяка увереност</option>
              <option value="low">Само ниска увереност</option>
              <option value="high">Само висока увереност</option>
            </select>
            <label className="admin-ai-category-search"><Search size={14} /><input value={categorySearch} onChange={event => setCategorySearch(event.target.value)} placeholder="Търсене на категория или подкатегория" aria-label="Търсене в категориите" /></label>
            <select value={categoryId} onChange={event => { setCategoryId(event.target.value ? Number(event.target.value) : ""); setPage(1); }} aria-label="Филтър по категория">
              <option value="">Всички категории</option>
              {visibleCategories.map(category => <option key={category.id} value={category.id}>{category.name} ({category.count})</option>)}
            </select>
            <select value={availability} onChange={event => { setAvailability(event.target.value as typeof availability); setPage(1); }} aria-label="Филтър по наличност">
              <option value="all">Всички наличности</option>
              <option value="in_stock">Само налични продукти</option>
              <option value="not_in_stock">Без наличност</option>
            </select>
            <select value={visibility} onChange={event => { setVisibility(event.target.value as typeof visibility); setPage(1); }} aria-label="Филтър по видимост в сайта">
              <option value="all">Показани и скрити</option>
              <option value="visible">Показани в сайта</option>
              <option value="hidden">Скрити от сайта</option>
            </select>
            <select value={sort} onChange={event => { setSort(event.target.value as typeof sort); setPage(1); }} aria-label="Сортиране на AI съдържанието">
              <option value="confidence-low">Ниска увереност първо</option>
              <option value="name-asc">Име: А → Я</option>
              <option value="name-desc">Име: Я → А</option>
              <option value="stock-desc">Наличност: най-много първо</option>
              <option value="stock-asc">Наличност: най-малко първо</option>
              <option value="updated-desc">Последно променени първо</option>
              <option value="updated-asc">Най-стари промени първо</option>
            </select>
          </div>
        </div>
        <div className="admin-ai-bulk-toolbar">
          <span><CheckSquare size={15} /> Избрани: <strong>{selectedIds.size}</strong></span>
          <button type="button" onClick={selectAllMatching} disabled={matchingIdsQuery.isFetching}>{matchingIdsQuery.isFetching ? "Зареждане…" : `Маркирай всички от филтъра (${matchingIdsQuery.data?.length ?? "…"})`}</button>
          <button type="button" onClick={() => setSelectedIds(new Set())} disabled={!selectedIds.size}>Изчисти избора</button>
          <button type="button" className="admin-primary" onClick={() => enqueueMutation.mutate({ productIds: Array.from(selectedIds) })} disabled={!selectedIds.size || enqueueMutation.isPending}>{enqueueMutation.isPending ? "Добавяне…" : "Генерирай за избраните"}</button>
          <button type="button" className="admin-primary admin-ai-approve-all" onClick={() => reviewBatchMutation.mutate({ productIds: Array.from(selectedIds), action: "approve" })} disabled={!selectedIds.size || reviewBatchMutation.isPending}>{reviewBatchMutation.isPending ? "Одобряване…" : `Одобри избраните (${selectedIds.size})`}</button>
          <button type="button" className="admin-primary" onClick={() => publishMutation.mutate({})} disabled={publishMutation.isPending}>{publishMutation.isPending ? "Публикуване…" : "Публикувай одобрените"}</button>
          <button type="button" onClick={() => publishMutation.mutate({ productIds: selectedApprovedIds })} disabled={!selectedApprovedIds.length || publishMutation.isPending}>{publishMutation.isPending ? "Публикуване…" : `Публикувай избраните одобрени (${selectedApprovedIds.length})`}</button>
          <button type="button" onClick={() => restoreMutation.mutate({ productIds: selectedRestorableIds })} disabled={!selectedRestorableIds.length || restoreMutation.isPending}>{restoreMutation.isPending ? "Възстановяване…" : `Върни старото (${selectedRestorableIds.length})`}</button>
        </div>
        {publishMutation.error && <div className="admin-form-error" role="alert">Публикуването не бе завършено: {publishMutation.error.message}</div>}
        {restoreMutation.error && <div className="admin-form-error" role="alert">Възстановяването не бе завършено: {restoreMutation.error.message}</div>}
        {publishMutation.data && <div className="admin-ai-saved" role="status">Публикувани: {publishMutation.data.published}. Пропуснати, защото не са одобрени: {publishMutation.data.skipped.length}.</div>}
        {restoreMutation.data && <div className="admin-ai-saved" role="status">Върнати стари данни: {restoreMutation.data.restored}. Пропуснати без backup: {restoreMutation.data.skipped.length}.</div>}
        {reviewBatchMutation.error && <div className="admin-form-error" role="alert">Bulk одобряването не бе завършено: {reviewBatchMutation.error.message}</div>}
        {reviewBatchMutation.data && <div className="admin-ai-saved" role="status">Одобрени: {reviewBatchMutation.data.reviewed}. Пропуснати: {reviewBatchMutation.data.skipped.length}.</div>}
        {queue && <div className="admin-ai-queue" role="status">
          <div><strong>Фонова опашка #{queue.batchId}</strong><span className={`admin-ai-status admin-ai-status-${queue.status}`}>{queue.status === "paused" ? "Пауза" : queue.status === "running" ? "Работи" : queue.status === "completed" ? "Завършена" : queue.status === "failed" ? "С грешки" : "Чакаща"}</span></div>
          <div className="admin-ai-queue-metrics"><span>Общо <b>{queue.total}</b></span><span>Готови <b>{queue.progress.succeeded}</b></span><span>Грешки <b>{queue.progress.failed}</b></span><span>В процес <b>{queue.progress.running}</b></span><span>Днес <b>{queue.dailyUsed}/{queue.dailyLimit}</b></span></div>
          {(queue.status === "running" || queue.status === "queued" || queue.status === "paused") && <button type="button" onClick={() => queueStatusMutation.mutate({ batchId: queue.batchId, status: queue.status === "paused" ? "queued" : "paused" })} disabled={queueStatusMutation.isPending}>{queue.status === "paused" ? <><Play size={14} /> Продължи</> : <><Pause size={14} /> Пауза</>}</button>}
        </div>}
        {contentQuery.isLoading ? <div className="admin-empty-state"><Loader2 className="animate-spin" /> Зареждане…</div> : contentQuery.error ? <div className="admin-form-error" role="alert">Нямате достъп или AI съдържанието не може да се зареди.</div> : (
          <div className="admin-ai-layout">
            <div className="admin-ai-list" aria-label="Списък с продукти">
              {items.map(item => (
                <div role="button" tabIndex={0} key={item.productId} className={`admin-ai-product ${selectedId === item.productId ? "is-selected" : ""}`} onClick={() => setSelectedId(item.productId)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(item.productId); } }}>
                  <input type="checkbox" checked={selectedIds.has(item.productId)} onChange={() => toggleSelected(item.productId)} onClick={event => event.stopPropagation()} aria-label={`Избери ${item.name}`} />
                  <img src={item.imageUrl} alt="" />
                  <span><strong>{item.name}</strong><small>{item.brand || "Без марка"} · SKU {item.sku || "—"}</small><small className="admin-ai-product-meta"><span className={item.stockQuantity > 0 ? "is-in-stock" : "is-out-of-stock"}>{item.stockQuantity > 0 ? `Налично: ${item.stockQuantity}` : "Няма наличност"}</span><span className={item.isActive ? "is-visible" : "is-hidden"}>{item.isActive ? "Показан в сайта" : "Скрит от сайта"}</span></small><small className="admin-ai-usage"><span>{item.aiProvider || "—"} / {item.aiModel || "—"}</span><span>in <strong>{item.aiInputTokens ?? 0}</strong></span><span>out <strong>{item.aiOutputTokens ?? 0}</strong></span><span>търсения <strong>{item.aiSearchCount}</strong></span></small></span>
                  <em className={statusClass(item.aiStatus)}>{statusLabels[item.aiStatus]}</em>
                  {item.canRestore && <small className="admin-ai-restore-ready">Има backup</small>}
                  <button type="button" className="admin-ai-row-generate" onClick={event => { event.stopPropagation(); generateMutation.mutate({ productId: item.productId }); }} disabled={generateMutation.isPending || settingsQuery.isLoading || !systemPrompt.trim()}>Генерирай</button>
                </div>
              ))}
              {!items.length && <div className="admin-empty-state"><Clock3 /> Няма продукти за този филтър.</div>}
              {contentQuery.data && contentQuery.data.total > contentQuery.data.pageSize && <div className="admin-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Назад</button><span>Страница {page} от {Math.ceil(contentQuery.data.total / contentQuery.data.pageSize)}</span><button type="button" disabled={page >= Math.ceil(contentQuery.data.total / contentQuery.data.pageSize)} onClick={() => setPage(value => value + 1)}>Напред</button></div>}
            </div>

            {selected && <form className="admin-ai-editor" onSubmit={save}>
              <div className="admin-ai-editor-head"><div><small>Избран продукт</small><h3>{selected.name}</h3><p>{selected.categoryName} · SKU/EAN {selected.sku || "—"}</p><p className="admin-ai-usage"><span>Доставчик: <strong>{selected.aiProvider || "—"}</strong></span><span>Модел: <strong>{selected.aiModel || "—"}</strong></span><span>Входни токени: <strong>{selected.aiInputTokens ?? 0}</strong></span><span>Изходни токени: <strong>{selected.aiOutputTokens ?? 0}</strong></span><span>Google търсения: <strong>{selected.aiSearchCount}</strong></span></p></div><img src={selected.imageUrl} alt="" /></div>
              <div className="admin-ai-compare" aria-label="Сравнение на старо и ново съдържание">
                <article><h4>Старо съдържание</h4><dl><dt>Описание</dt><dd>{displayValue(selected.oldDescription)}</dd><dt>Технически данни</dt><dd>{displayValue(selected.oldFeatures)}</dd><dt>SEO заглавие</dt><dd>{displayValue(selected.oldSeoTitle)}</dd><dt>SEO описание</dt><dd>{displayValue(selected.oldSeoDescription)}</dd><dt>Ключови думи</dt><dd>{displayValue(selected.oldKeywords)}</dd></dl></article>
                <article><h4>Ново AI съдържание</h4><dl><dt>Описание</dt><dd>{displayValue(form.aiDescription)}</dd><dt>Характеристики</dt><dd>{displayValue(newFeatures)}</dd><dt>SEO заглавие</dt><dd>{displayValue(form.aiSeoTitle)}</dd><dt>SEO описание</dt><dd>{displayValue(form.aiSeoDescription)}</dd><dt>Ключови думи</dt><dd>{displayValue(form.aiKeywords)}</dd></dl></article>
              </div>
              <div className="admin-ai-sources"><strong>Източници</strong>{newSourceUrls.length ? <ul>{newSourceUrls.map(url => <li key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul> : <span>Няма добавени източници.</span>}</div>
              <div className="admin-ai-generate-row"><button type="button" className="admin-primary" onClick={() => generateMutation.mutate({ productId: selected.productId })} disabled={generateMutation.isPending || settingsQuery.isLoading || !systemPrompt.trim()}><Sparkles size={15} /> {generateMutation.isPending ? "Генериране…" : "Генерирай от prompt-а"}</button><span>Резултатът се записва в AI слоя и не променя продукта.</span></div>
              {generateMutation.error && <div className="admin-form-error" role="alert">{generateMutation.error.message}</div>}
              {generateMutation.data?.status === "error" && <div className="admin-form-error" role="alert">Генерирането завърши с грешка. Проверете AI статуса и полето „AI грешка“.</div>}
              {generateMutation.data?.status === "generated" && <div className="admin-ai-saved" role="status"><CheckCircle2 size={15} /> AI съдържанието е генерирано и е отделено от продукта.</div>}
              <label>AI статус<select value={form.aiStatus} onChange={event => setForm(current => ({ ...current, aiStatus: event.target.value as AiStatus }))}>{(Object.keys(statusLabels) as AiStatus[]).map(key => <option key={key} value={key}>{statusLabels[key]}</option>)}</select></label>
              <label>AI описание<textarea value={form.aiDescription} onChange={event => setForm(current => ({ ...current, aiDescription: event.target.value }))} rows={4} /></label>
              <label>AI характеристики<textarea value={form.aiFeatures} onChange={event => setForm(current => ({ ...current, aiFeatures: event.target.value }))} rows={4} placeholder="Една характеристика на ред" /></label>
              <div className="admin-ai-editor-grid"><label>AI SEO заглавие<input value={form.aiSeoTitle} onChange={event => setForm(current => ({ ...current, aiSeoTitle: event.target.value }))} /></label><label>AI ключови думи<input value={form.aiKeywords} onChange={event => setForm(current => ({ ...current, aiKeywords: event.target.value }))} /></label></div>
              <label>AI SEO описание<textarea value={form.aiSeoDescription} onChange={event => setForm(current => ({ ...current, aiSeoDescription: event.target.value }))} rows={3} /></label>
              <label>AI източници — URL адреси<textarea value={form.aiSourceUrls} onChange={event => setForm(current => ({ ...current, aiSourceUrls: event.target.value }))} rows={3} placeholder="По един URL на ред" /></label>
              <div className="admin-ai-editor-grid"><label>Увереност<select value={form.aiConfidence} onChange={event => setForm(current => ({ ...current, aiConfidence: event.target.value as AiConfidence | "" }))}><option value="">Не е оценена</option><option value="high">Висока</option><option value="low">Ниска</option></select></label><label>Генерирано на<input type="datetime-local" value={form.aiGeneratedAt} onChange={event => setForm(current => ({ ...current, aiGeneratedAt: event.target.value }))} /></label></div>
              <label>AI грешка<textarea value={form.aiError} onChange={event => setForm(current => ({ ...current, aiError: event.target.value }))} rows={2} placeholder="Попълва се при статус „Грешка“" /></label>
              {saveMutation.error && <div className="admin-form-error" role="alert">{saveMutation.error.message}</div>}
              {saveMutation.isSuccess && <div className="admin-ai-saved" role="status"><CheckCircle2 size={15} /> AI полетата са запазени отделно от продукта.</div>}
              <div className="admin-ai-review-actions"><button type="button" className="admin-primary" onClick={() => reviewMutation.mutate({ productId: selected.productId, action: "approve" })} disabled={reviewMutation.isPending}>Одобри</button><button type="button" className="admin-primary admin-ai-approve-next" onClick={() => reviewMutation.mutate({ productId: selected.productId, action: "approve" }, { onSuccess: () => { if (nextReviewable) setSelectedId(nextReviewable.productId); } })} disabled={reviewMutation.isPending || !nextReviewable}>Одобри и следващия</button><button type="button" className="admin-ai-reject" onClick={() => reviewMutation.mutate({ productId: selected.productId, action: "reject" })} disabled={reviewMutation.isPending}>Отхвърли</button>{reviewMutation.error && <span className="admin-form-error" role="alert">{reviewMutation.error.message}</span>}</div>
              <button type="submit" className="admin-primary" disabled={saveMutation.isPending}><Save size={15} /> {saveMutation.isPending ? "Записване…" : "Запази AI съдържанието"}</button>
            </form>}
          </div>
        )}
      </div>
    </section>
  );
}
