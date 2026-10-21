import { trpc } from "@/lib/trpc";
import { CheckCircle2, Clock3, FileWarning, Loader2, Save, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type AiStatus = "pending" | "generated" | "reviewed" | "published" | "error";
type AiConfidence = "high" | "low";

type AiItem = {
  productId: number;
  name: string;
  sku: string | null;
  brand: string | null;
  imageUrl: string;
  categoryName: string;
  isActive: boolean;
  isArchived: boolean;
  aiStatus: AiStatus;
  aiDescription: string | null;
  aiFeatures: string | null;
  aiSeoTitle: string | null;
  aiSeoDescription: string | null;
  aiKeywords: string | null;
  aiSourceUrls: string[];
  aiConfidence: AiConfidence | null;
  aiError: string | null;
  aiGeneratedAt: Date | string | null;
};

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
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
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
  const input = useMemo(() => ({ status: status || undefined, query: query.trim() || undefined, page, pageSize: 50 }), [status, query, page]);
  const contentQuery = trpc.admin.aiContent.useQuery(input);
  const settingsQuery = trpc.admin.aiSettings.useQuery();
  const utils = trpc.useUtils();
  const saveSettingsMutation = trpc.admin.saveAiSettings.useMutation({
    onSuccess: async () => { await utils.admin.aiSettings.invalidate(); },
  });
  const saveMutation = trpc.admin.saveAiContent.useMutation({
    onSuccess: async () => {
      await utils.admin.aiContent.invalidate();
    },
  });
  const generateMutation = trpc.admin.generateAiContent.useMutation({
    onSuccess: async () => { await utils.admin.aiContent.invalidate(); },
  });
  const items = (contentQuery.data?.items ?? []) as AiItem[];
  const selected = items.find(item => item.productId === selectedId) ?? null;

  useEffect(() => {
    if (settingsQuery.data?.systemPrompt && !systemPrompt) setSystemPrompt(settingsQuery.data.systemPrompt);
  }, [settingsQuery.data?.systemPrompt, systemPrompt]);

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
    saveSettingsMutation.mutate({ systemPrompt });
  };

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
          <div className="admin-ai-filters">
            <label className="admin-search"><Search size={15} /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Име, марка или SKU" aria-label="Търсене в AI съдържанието" /></label>
            <select value={status} onChange={event => { setStatus(event.target.value as AiStatus | ""); setPage(1); }} aria-label="Филтър по AI статус">
              <option value="">Всички статуси</option>
              {(Object.keys(statusLabels) as AiStatus[]).map(key => <option key={key} value={key}>{statusLabels[key]}</option>)}
            </select>
          </div>
        </div>
        {contentQuery.isLoading ? <div className="admin-empty-state"><Loader2 className="animate-spin" /> Зареждане…</div> : contentQuery.error ? <div className="admin-form-error" role="alert">Нямате достъп или AI съдържанието не може да се зареди.</div> : (
          <div className="admin-ai-layout">
            <div className="admin-ai-list" aria-label="Списък с продукти">
              {items.map(item => (
                <button type="button" key={item.productId} className={`admin-ai-product ${selectedId === item.productId ? "is-selected" : ""}`} onClick={() => setSelectedId(item.productId)}>
                  <img src={item.imageUrl} alt="" />
                  <span><strong>{item.name}</strong><small>{item.brand || "Без марка"} · SKU {item.sku || "—"}</small></span>
                  <em className={statusClass(item.aiStatus)}>{statusLabels[item.aiStatus]}</em>
                </button>
              ))}
              {!items.length && <div className="admin-empty-state"><Clock3 /> Няма продукти за този филтър.</div>}
              {contentQuery.data && contentQuery.data.total > contentQuery.data.pageSize && <div className="admin-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Назад</button><span>Страница {page} от {Math.ceil(contentQuery.data.total / contentQuery.data.pageSize)}</span><button type="button" disabled={page >= Math.ceil(contentQuery.data.total / contentQuery.data.pageSize)} onClick={() => setPage(value => value + 1)}>Напред</button></div>}
            </div>

            {selected && <form className="admin-ai-editor" onSubmit={save}>
              <div className="admin-ai-editor-head"><div><small>Избран продукт</small><h3>{selected.name}</h3><p>{selected.categoryName} · SKU/EAN {selected.sku || "—"}</p></div><img src={selected.imageUrl} alt="" /></div>
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
              <button type="submit" className="admin-primary" disabled={saveMutation.isPending}><Save size={15} /> {saveMutation.isPending ? "Записване…" : "Запази AI съдържанието"}</button>
            </form>}
          </div>
        )}
      </div>
    </section>
  );
}
