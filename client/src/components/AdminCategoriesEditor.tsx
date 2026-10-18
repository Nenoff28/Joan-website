import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FolderTree,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { latinPathToken } from "@/lib/categoryHierarchy";
import { readProductImage } from "@/lib/productImageUpload";
import { hasPermission } from "@shared/permissions";
import {
  categoryPayloadSchema,
  categoryValidationMessage,
} from "@shared/categoryValidation";
import "./adminCategoriesEditor.css";

type CategoryRow = {
  id: number;
  label: string;
  slug: string;
  description: string;
  image: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  parentId: number | null;
  rootId: number | null;
  depth: number;
  isMain: boolean;
  legacyCategoryId: number | null;
  publicUrl: string | null;
};
type CategoryDraft = {
  id?: number;
  kind: "main" | "child";
  parentId: string;
  name: string;
  slug: string;
  automaticSlug: boolean;
  description: string;
  imageUrl: string;
  icon: string;
  sortOrder: string;
  isActive: boolean;
  imported: boolean;
};
const emptyDraft = (parentId?: number): CategoryDraft => ({
  kind: parentId ? "child" : "main",
  parentId: parentId ? String(parentId) : "",
  name: "",
  slug: "",
  automaticSlug: true,
  description: "",
  imageUrl: "",
  icon: "house",
  sortOrder: "0",
  isActive: true,
  imported: false,
});
const icons = [
  ["house", "Дом"],
  ["drill", "Инструменти"],
  ["trees", "Градина"],
  ["bath", "Баня"],
  ["lamp", "Осветление"],
  ["panels-top-left", "Покрития"],
  ["waves", "ВиК"],
  ["lock-keyhole", "Обков"],
  ["paint-roller", "Бои"],
  ["brick-wall", "Строителство"],
  ["hard-hat", "Работно облекло"],
];

export default function AdminCategoriesEditor({
  permissions,
}: {
  permissions: readonly string[];
}) {
  const canRead = hasPermission(permissions, "categories.read");
  const canWrite = hasPermission(permissions, "categories.write");
  const utils = trpc.useUtils();
  const query = trpc.admin.categories.useQuery(undefined, {
    enabled: canRead,
    staleTime: 0,
  });
  const rows: CategoryRow[] = (query.data ?? []) as CategoryRow[];
  const [draft, setDraft] = useState<CategoryDraft>(() => emptyDraft());
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [saved, setSaved] = useState<{ id: number; label: string } | null>(
    null
  );
  const [uploading, setUploading] = useState(false);
  const uploadBusy = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLElement>(null);
  const upload = trpc.admin.uploadCategoryImage.useMutation();
  const save = trpc.admin.saveCategory.useMutation({
    onSuccess: async id => {
      setDraft(current => ({ ...current, id, automaticSlug: false }));
      setSaved({ id, label: draft.name.trim() });
      setError("");
      toast.success("Категорията е записана успешно.");
      await Promise.all([
        utils.admin.categories.invalidate(),
        utils.admin.productCategories.invalidate(),
        utils.admin.products.invalidate(),
        utils.admin.operations.invalidate(),
        utils.catalogue.metadata.invalidate(),
        utils.catalogue.list.invalidate(),
        utils.catalogue.page.invalidate(),
      ]);
    },
    onError: failure => {
      const message = categoryValidationMessage(failure);
      setError(message);
      toast.error(message);
    },
  });
  const busy = uploading || save.isPending;
  const byId = useMemo(
    () => new Map(rows.map(row => [row.id, row])),
    [query.data]
  );
  const categoryPath = (row: CategoryRow) => {
    const parts = [row.label];
    const seen = new Set([row.id]);
    let parentId = row.parentId;
    while (parentId != null && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      parts.unshift(parent.label);
      parentId = parent.parentId;
    }
    return parts.join(" / ");
  };
  const blockedParents = useMemo(() => {
    const blocked = new Set<number>();
    if (!draft.id) return blocked;
    const pending = [draft.id];
    while (pending.length) {
      const id = pending.pop()!;
      if (blocked.has(id)) continue;
      blocked.add(id);
      for (const row of rows) if (row.parentId === id) pending.push(row.id);
    }
    return blocked;
  }, [draft.id, query.data]);
  const parents = rows.filter(
    row =>
      row.depth < 4 && !blockedParents.has(row.id) && Boolean(row.publicUrl)
  );
  const visibleRows = rows.filter(row =>
    categoryPath(row)
      .toLocaleLowerCase("bg-BG")
      .includes(search.trim().toLocaleLowerCase("bg-BG"))
  );
  const savedRow = saved ? byId.get(saved.id) : undefined;
  const selectedParent = byId.get(Number(draft.parentId));
  function change<K extends keyof CategoryDraft>(
    key: K,
    value: CategoryDraft[K]
  ) {
    setDraft(current => ({ ...current, [key]: value }));
    setError("");
    setSaved(null);
  }
  function start(parentId?: number) {
    if (busy) return;
    setDraft(emptyDraft(parentId));
    setError("");
    setUploadError("");
    setSaved(null);
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function edit(row: CategoryRow) {
    if (busy) return;
    setDraft({
      id: row.id,
      kind: row.isMain ? "main" : "child",
      parentId: row.parentId == null ? "" : String(row.parentId),
      name: row.label,
      slug: row.slug,
      automaticSlug: false,
      description: row.description,
      imageUrl: row.image,
      icon: row.icon,
      sortOrder: String(row.sortOrder),
      isActive: row.isActive,
      imported: row.legacyCategoryId != null,
    });
    setError("");
    setUploadError("");
    setSaved(null);
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canWrite || uploadBusy.current || save.isPending) return;
    uploadBusy.current = true;
    setUploading(true);
    setUploadError("");
    try {
      const image = await upload.mutateAsync({
        dataUrl: await readProductImage(file),
        fileName: file.name.slice(0, 160),
      });
      if (!image.url)
        throw new Error("Не получихме адрес на снимката. Опитайте отново.");
      setDraft(current => ({ ...current, imageUrl: image.url }));
      setError("");
      setSaved(null);
      toast.success("Снимката е качена.");
    } catch (failure) {
      const message = categoryValidationMessage(failure);
      setUploadError(message);
      toast.error(message);
    } finally {
      uploadBusy.current = false;
      setUploading(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || busy || uploadBusy.current) return;
    if (
      draft.kind === "child" &&
      (!selectedParent || !parents.some(row => row.id === selectedParent.id))
    ) {
      setError("Изберете категория родител от падащия списък.");
      return;
    }
    const parsed = categoryPayloadSchema.safeParse({
      parentId: draft.kind === "main" ? null : Number(draft.parentId),
      slug: draft.slug.trim(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      imageUrl: draft.imageUrl.trim(),
      icon: draft.icon,
      sortOrder: Number(draft.sortOrder),
      isActive: draft.isActive,
    });
    if (!parsed.success) {
      const message = categoryValidationMessage(parsed.error);
      setError(message);
      toast.error(message);
      return;
    }
    save.mutate({ id: draft.id, category: parsed.data });
  }
  return (
    <section className="admin-workspace category-editor-workspace">
      <header className="category-editor-heading">
        <div>
          <p className="admin-kicker">КАТЕГОРИИ</p>
          <h1>Структура на каталога</h1>
          <p>
            Създайте главна категория със снимка или добавете подкатегория към
            избран родител.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            className="admin-primary"
            disabled={busy}
            onClick={() => start()}
          >
            <Plus size={17} /> Нова категория
          </button>
        )}
      </header>
      <section
        className="admin-edit-panel category-editor-panel"
        ref={editorRef}
      >
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">
              {draft.id ? "РЕДАКЦИЯ" : "НОВА КАТЕГОРИЯ"}
            </p>
            <h2>{draft.id ? draft.name : "Създаване на категория"}</h2>
          </div>
          <FolderTree size={26} />
        </div>
        {saved && (
          <div className="category-editor-success" role="status">
            <CheckCircle2 size={20} />
            <div>
              <strong>„{saved.label}“ е записана успешно.</strong>
              <p>
                {savedRow?.publicUrl
                  ? "Категорията вече е достъпна в каталога и при добавяне на артикули."
                  : !savedRow || query.isFetching
                    ? "Записът е запазен. Обновяваме структурата на каталога…"
                    : "Записът е запазен. Скритите категории не се показват в публичния каталог."}
              </p>
              <div>
                {savedRow?.publicUrl && (
                  <Link href={savedRow.publicUrl}>
                    Виж категорията <ArrowUpRight size={14} />
                  </Link>
                )}
                {savedRow && savedRow.depth < 4 && savedRow.publicUrl && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => start(saved.id)}
                  >
                    <Plus size={15} /> Добави подкатегория
                  </button>
                )}
                <button type="button" disabled={busy} onClick={() => start()}>
                  <Plus size={15} /> Нова главна категория
                </button>
              </div>
            </div>
          </div>
        )}
        <form
          className="admin-form category-editor-form"
          noValidate
          onSubmit={submit}
        >
          <fieldset disabled={!canWrite || busy}>
            <legend className="sr-only">Данни за категорията</legend>
            <div
              className="category-kind-selector"
              role="radiogroup"
              aria-label="Тип категория"
            >
              <label className={draft.kind === "main" ? "selected" : ""}>
                <input
                  type="radio"
                  name="category-kind"
                  value="main"
                  checked={draft.kind === "main"}
                  disabled={draft.imported}
                  onChange={() => change("kind", "main")}
                />
                <span>
                  <strong>Главна категория</strong>
                  <small>Самостоятелна категория със снимка</small>
                </span>
              </label>
              <label className={draft.kind === "child" ? "selected" : ""}>
                <input
                  type="radio"
                  name="category-kind"
                  value="child"
                  checked={draft.kind === "child"}
                  disabled={draft.imported}
                  onChange={() => change("kind", "child")}
                />
                <span>
                  <strong>Подкатегория</strong>
                  <small>Под главна или друга подкатегория</small>
                </span>
              </label>
            </div>
            {draft.kind === "child" && (
              <label>
                Категория родител
                <select
                  aria-label="Категория родител"
                  value={draft.parentId}
                  disabled={
                    query.isLoading || Boolean(query.error) || draft.imported
                  }
                  onChange={event => change("parentId", event.target.value)}
                >
                  <option value="" disabled>
                    {query.isLoading
                      ? "Зареждаме категориите…"
                      : "Изберете родител"}
                  </option>
                  {parents.map(row => (
                    <option key={row.id} value={row.id}>
                      {categoryPath(row)}
                    </option>
                  ))}
                </select>
                <small>
                  Изберете къде да се появи подкатегорията, например „Баня /
                  Плочки“. Поддържат се до 4 нива.
                </small>
              </label>
            )}
            {query.error && (
              <div className="category-editor-error" role="alert">
                <AlertTriangle size={18} />
                <span>
                  Не успяхме да заредим категориите. Въведените данни са
                  запазени.
                </span>
              </div>
            )}
            <div className="admin-form-grid">
              <label>
                Име на категорията{" "}
                <input
                  maxLength={255}
                  value={draft.name}
                  onChange={event => {
                    const name = event.target.value;
                    setDraft(current => ({
                      ...current,
                      name,
                      slug: current.automaticSlug
                        ? name.trim()
                          ? latinPathToken(name)
                          : ""
                        : current.slug,
                    }));
                    setSaved(null);
                    setError("");
                  }}
                  placeholder="Например: Плочки"
                />
              </label>
              <label>
                URL адрес (slug)
                <input
                  value={draft.slug}
                  disabled={Boolean(draft.id)}
                  maxLength={128}
                  onChange={event => {
                    setDraft(current => ({
                      ...current,
                      slug: event.target.value.toLowerCase(),
                      automaticSlug: false,
                    }));
                    setSaved(null);
                    setError("");
                  }}
                  placeholder="plochki"
                />
                <small>
                  {draft.id
                    ? "Адресът е запазен, за да не се прекъсват съществуващи връзки."
                    : "Попълва се автоматично от името. Можете да го редактирате; само латински букви, цифри и тирета."}
                </small>
              </label>
            </div>
            <label>
              Описание{" "}
              <span className="category-editor-optional">(по желание)</span>
              <textarea
                rows={3}
                value={draft.description}
                onChange={event => change("description", event.target.value)}
                placeholder="Кратко описание на категорията"
              />
            </label>
            {draft.kind === "main" && (
              <div className="category-editor-media">
                <div>
                  <h3>Снимка на главната категория</h3>
                  <p>
                    JPG, PNG или WEBP · до 10 MB. За добър изглед използвайте
                    хоризонтална снимка.
                  </p>
                  <button
                    type="button"
                    className="category-editor-upload"
                    disabled={!canWrite || busy}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 size={22} className="animate-spin" />
                    ) : (
                      <ImagePlus size={22} />
                    )}{" "}
                    {uploading
                      ? "Качване на снимката…"
                      : draft.imageUrl
                        ? "Смени снимката"
                        : "Качи снимка"}
                  </button>
                </div>
                <div className="category-editor-preview">
                  {draft.imageUrl ? (
                    <>
                      <img
                        src={draft.imageUrl}
                        alt={draft.name || "Предварителен изглед на категория"}
                      />
                      <button
                        type="button"
                        aria-label="Премахни снимката"
                        disabled={!canWrite || busy}
                        onClick={() => change("imageUrl", "")}
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <span>
                      <ImagePlus size={28} /> Предварителен изглед
                    </span>
                  )}
                </div>
              </div>
            )}
            {uploadError && (
              <div className="category-editor-error" role="alert">
                <AlertTriangle size={18} />
                <span>{uploadError}</span>
              </div>
            )}
            <div className="admin-form-grid">
              <label>
                Икона
                <select
                  value={draft.icon}
                  onChange={event => change("icon", event.target.value)}
                >
                  {icons.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Подредба
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={draft.sortOrder}
                  onChange={event => change("sortOrder", event.target.value)}
                />
                <small>По-малкият номер се показва по-напред.</small>
              </label>
            </div>
            {!draft.imported && (
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={event => change("isActive", event.target.checked)}
                />{" "}
                Показвай в публичния каталог
              </label>
            )}
            {draft.imported && (
              <p className="category-editor-note">
                Това е съществуваща подкатегория. Запазваме връзките ѝ с
                родителя и продуктите.
              </p>
            )}
            {error && (
              <div className="category-editor-error" role="alert">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}
            <div className="admin-form-actions">
              {canWrite ? (
                <button type="submit" className="admin-primary" disabled={busy}>
                  {save.isPending ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Save size={17} />
                  )}{" "}
                  {save.isPending ? "Записваме…" : "Запази категорията"}
                </button>
              ) : (
                <span className="category-editor-note">
                  Само преглед · редакцията е недостъпна
                </span>
              )}
              {draft.id && canWrite && (
                <button
                  type="button"
                  className="admin-secondary"
                  disabled={busy}
                  onClick={() => start()}
                >
                  Нова категория
                </button>
              )}
            </div>
          </fieldset>
        </form>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          aria-label="Снимка на категорията"
          disabled={!canWrite || busy}
          onChange={chooseImage}
        />
        {query.error && canRead && (
          <button
            type="button"
            className="admin-text-action"
            onClick={() => query.refetch()}
          >
            Зареди категориите отново
          </button>
        )}
      </section>
      <section className="admin-panel category-tree-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">СТРУКТУРА</p>
            <h2>Категории и подкатегории</h2>
          </div>
        </div>
        <label className="category-tree-search">
          <Search size={18} />
          <input
            aria-label="Търсене на категория"
            placeholder="Търси по име или път…"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </label>
        {query.isLoading ? (
          <p role="status">
            <Loader2 size={18} className="animate-spin" /> Зареждаме
            категориите…
          </p>
        ) : !visibleRows.length ? (
          <p>Няма категории за показване.</p>
        ) : (
          <div className="category-tree-list">
            {visibleRows.map(row => (
              <article
                key={row.id}
                className={
                  row.isMain ? "category-tree-row main" : "category-tree-row"
                }
              >
                {row.isMain && row.image ? (
                  <img src={row.image} alt="" loading="lazy" />
                ) : (
                  <span className="category-tree-icon">
                    <FolderTree size={19} />
                  </span>
                )}
                <div className="category-tree-label">
                  <span>
                    {row.isMain ? "Главна категория" : "Подкатегория"} ·{" "}
                    {row.publicUrl ? "В каталога" : "Скрита"}
                  </span>
                  <h3>{row.label}</h3>
                  <p>{categoryPath(row)}</p>
                </div>
                <div className="category-tree-actions">
                  {row.publicUrl && (
                    <Link href={row.publicUrl} className="admin-text-action">
                      Виж <ArrowUpRight size={14} />
                    </Link>
                  )}
                  {canWrite ? (
                    <>
                      <button
                        type="button"
                        className="admin-text-action"
                        disabled={busy}
                        onClick={() => edit(row)}
                      >
                        Редакция
                      </button>
                      {row.depth < 4 && row.publicUrl && (
                        <button
                          type="button"
                          className="admin-text-action"
                          disabled={busy}
                          onClick={() => start(row.id)}
                        >
                          <Plus size={14} /> Подкатегория
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="category-editor-note">Само преглед</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
