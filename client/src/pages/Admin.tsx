/** Internal administration workspace: operational, data-dense, and separated from the public Joan storefront. */
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Archive, ArrowUpRight, Boxes, ClipboardList, ImagePlus, Loader2, PackageCheck, Plus, Save, Tags, Trash2 } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Availability = "in_stock" | "on_request" | "out_of_stock";
type OrderStatus = "new" | "contacted" | "confirmed" | "closed" | "cancelled";

type ProductForm = {
  id?: number;
  categoryId: number;
  slug: string;
  sku: string;
  brand: string;
  name: string;
  description: string;
  imageUrl: string;
  galleryText: string;
  imageAlt: string;
  priceEur: string;
  priceBgn: string;
  oldPriceEur: string;
  oldPriceBgn: string;
  discountLabel: string;
  availability: Availability;
  stockQuantity: string;
  featuresText: string;
  isActive: boolean;
};

type CategoryForm = {
  id?: number;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  icon: string;
  subcategoriesText: string;
  sortOrder: string;
  isActive: boolean;
};

type AdminOrder = {
  id: number;
  requestNumber: string;
  productName: string;
  productImageUrl: string;
  quantity: number;
  totalEur: string | null;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postcode: string;
  status: OrderStatus;
  adminNote: string | null;
  createdAt: Date;
};

const statusLabels: Record<OrderStatus, string> = { new: "Нова", contacted: "Свързване", confirmed: "Потвърдена", closed: "Приключена", cancelled: "Отказана" };
const availabilityLabels: Record<Availability, string> = { in_stock: "На склад", on_request: "По запитване", out_of_stock: "Изчерпан" };
const numericOrNull = (value: string) => value.trim() === "" ? null : Number(value);
const textLines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);
const formatDate = (value: Date | string) => new Date(value).toLocaleString("bg-BG", { dateStyle: "medium", timeStyle: "short" });

function ShellHeading({ section, title, text, action }: { section: string; title: string; text: string; action?: React.ReactNode }) {
  return <header className="admin-heading"><div><p className="admin-kicker">ЖОАН · {section}</p><h1>{title}</h1><p>{text}</p></div>{action}</header>;
}

function AdminOverview() {
  const summary = trpc.admin.summary.useQuery();
  if (summary.isLoading) return <LoadingState />;
  if (!summary.data) return <ErrorState />;
  const cards = [
    { label: "Публикувани артикули", value: summary.data.products, icon: Boxes, href: "/admin/products" },
    { label: "Активни категории", value: summary.data.categories, icon: Tags, href: "/admin/categories" },
    { label: "Нови заявки", value: summary.data.newOrders, icon: ClipboardList, href: "/admin/orders" },
    { label: "Артикули на склад", value: summary.data.inStockProducts, icon: PackageCheck, href: "/admin/products" },
  ];
  return <section className="admin-workspace"><ShellHeading section="ОБЗОР" title="Оперативен каталог" text="Управлявайте продуктите, наличностите и заявките за потвърждение от едно място." />
    <div className="admin-stat-grid">{cards.map((card) => <button key={card.label} type="button" className="admin-stat-card" onClick={() => { window.location.href = card.href; }}><card.icon size={21} /><span>{card.label}</span><b>{card.value}</b><ArrowUpRight size={17} /></button>)}</div>
    <section className="admin-workbench-bays" aria-label="Контролни ленти"><div><span>01</span><p><b>ПУБЛИЧЕН КАТАЛОГ</b>{summary.data.products} публикувани артикула, управлявани от базата данни.</p></div><div><span>02</span><p><b>НАЛИЧНОСТИ</b>{summary.data.inStockProducts} артикула са маркирани като налични на склад.</p></div><div><span>03</span><p><b>ЗАЯВКИ</b>{summary.data.newOrders ? `${summary.data.newOrders} нови заявки очакват обработка.` : "Няма нови заявки в работната опашка."}</p></div></section>
    <section className="admin-panel"><div className="admin-panel-head"><div><p className="admin-kicker">ПОСЛЕДНИ ЗАЯВКИ</p><h2>Работна опашка</h2></div><button type="button" className="admin-text-action" onClick={() => { window.location.href = "/admin/orders"; }}>Всички заявки <ArrowUpRight size={16} /></button></div>{summary.data.recentOrders.length ? <div className="admin-mini-list">{summary.data.recentOrders.map((order) => <div key={order.id}><span className={`admin-status status-${order.status}`}>{statusLabels[order.status]}</span><b>{order.requestNumber}</b><p>{order.productName}</p><small>{order.fullName} · {formatDate(order.createdAt)}</small></div>)}</div> : <EmptyState icon={ClipboardList} title="Няма постъпили заявки." text="Когато клиент изпрати заявка от формата за доставка, тя ще се появи тук и в раздел „Заявки“." />}</section>
  </section>;
}

function AdminProducts() {
  const utils = trpc.useUtils();
  const productsQuery = trpc.admin.products.useQuery();
  const categoriesQuery = trpc.admin.categories.useQuery();
  const uploadImage = trpc.admin.uploadProductImage.useMutation();
  const createProduct = trpc.admin.createProduct.useMutation({ onSuccess: async () => { await utils.admin.products.invalidate(); toast("Артикулът е добавен."); } });
  const updateProduct = trpc.admin.updateProduct.useMutation({ onSuccess: async () => { await utils.admin.products.invalidate(); toast("Промените са записани."); } });
  const [form, setForm] = useState<ProductForm>(() => emptyProductForm(0));
  const [search, setSearch] = useState("");

  useEffect(() => { if (form.categoryId === 0 && categoriesQuery.data?.[0]) setForm(emptyProductForm(categoriesQuery.data[0].id)); }, [categoriesQuery.data, form.categoryId]);
  const visibleProducts = useMemo(() => (productsQuery.data ?? []).filter((product) => `${product.name} ${product.brand ?? ""} ${product.sku ?? ""}`.toLocaleLowerCase("bg").includes(search.toLocaleLowerCase("bg"))), [productsQuery.data, search]);
  const saving = createProduct.isPending || updateProduct.isPending;

  function update<K extends keyof ProductForm>(key: K, value: ProductForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function edit(product: NonNullable<typeof productsQuery.data>[number]) {
    setForm({ id: product.id, categoryId: product.categoryId, slug: product.slug, sku: product.sku ?? "", brand: product.brand ?? "", name: product.name, description: product.description, imageUrl: product.image, galleryText: product.gallery.join("\n"), imageAlt: product.imageAlt, priceEur: product.price?.replace("€", "") ?? "", priceBgn: product.priceBgn?.replace(" лв", "") ?? "", oldPriceEur: product.oldPrice?.replace("€", "") ?? "", oldPriceBgn: product.oldPriceBgn?.replace(" лв", "") ?? "", discountLabel: product.discount ?? "", availability: product.availabilityCode ?? "on_request", stockQuantity: String(product.stockQuantity ?? 0), featuresText: product.features.join("\n"), isActive: product.isActive });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { categoryId: form.categoryId, slug: form.slug.trim(), sku: form.sku.trim() || null, brand: form.brand.trim() || null, name: form.name.trim(), description: form.description.trim(), imageUrl: form.imageUrl.trim(), gallery: textLines(form.galleryText), imageAlt: form.imageAlt.trim(), priceEur: numericOrNull(form.priceEur), priceBgn: numericOrNull(form.priceBgn), oldPriceEur: numericOrNull(form.oldPriceEur), oldPriceBgn: numericOrNull(form.oldPriceBgn), discountLabel: form.discountLabel.trim() || null, availability: form.availability, stockQuantity: Math.max(0, Number(form.stockQuantity) || 0), features: textLines(form.featuresText), isActive: form.isActive };
    if (form.id) updateProduct.mutate({ id: form.id, product: payload });
    else createProduct.mutate(payload);
  }
  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 4 * 1024 * 1024) { toast("Изберете JPG, PNG или WEBP изображение до 4 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => uploadImage.mutate({ dataUrl: String(reader.result), fileName: file.name }, { onSuccess: (stored) => { update("imageUrl", stored.url); if (!form.galleryText.trim()) update("galleryText", stored.url); toast("Снимката е качена."); }, onError: () => toast("Снимката не можа да бъде качена.") });
    reader.readAsDataURL(file);
  }

  return <section className="admin-workspace"><ShellHeading section="АРТИКУЛИ" title="Управление на каталог" text="Добавяйте, редактирайте, архивирайте и поддържайте цените, наличностите и медията на артикулите." action={<button type="button" className="admin-primary" onClick={() => setForm(emptyProductForm(categoriesQuery.data?.[0]?.id ?? 0))}><Plus size={17} /> Нов артикул</button>} />
    <section className="admin-edit-panel"><div className="admin-panel-head"><div><p className="admin-kicker">{form.id ? "РЕДАКЦИЯ" : "НОВ ЗАПИС"}</p><h2>{form.id ? form.name || "Артикул" : "Нов артикул"}</h2></div>{form.id && <button type="button" className="admin-text-action" onClick={() => setForm(emptyProductForm(categoriesQuery.data?.[0]?.id ?? 0))}><Trash2 size={15} /> Откажи редакцията</button>}</div><form className="admin-form" onSubmit={submit}><div className="admin-form-grid"><label>Име на артикул<input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label><label>URL адрес (slug)<input required pattern="[a-z0-9-]+" value={form.slug} onChange={(event) => update("slug", event.target.value.toLowerCase())} /></label><label>Категория<select required value={form.categoryId} onChange={(event) => update("categoryId", Number(event.target.value))}>{(categoriesQuery.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label><label>Марка<input value={form.brand} onChange={(event) => update("brand", event.target.value)} /></label><label>Артикулен код<input value={form.sku} onChange={(event) => update("sku", event.target.value)} /></label><label>Наличност<select value={form.availability} onChange={(event) => update("availability", event.target.value as Availability)}>{(Object.keys(availabilityLabels) as Availability[]).map((availability) => <option key={availability} value={availability}>{availabilityLabels[availability]}</option>)}</select></label><label>Количество<input type="number" min="0" value={form.stockQuantity} onChange={(event) => update("stockQuantity", event.target.value)} /></label><label>Цена EUR<input type="number" min="0" step="0.01" value={form.priceEur} onChange={(event) => update("priceEur", event.target.value)} /></label><label>Цена BGN<input type="number" min="0" step="0.01" value={form.priceBgn} onChange={(event) => update("priceBgn", event.target.value)} /></label><label>Стара цена EUR<input type="number" min="0" step="0.01" value={form.oldPriceEur} onChange={(event) => update("oldPriceEur", event.target.value)} /></label><label>Стара цена BGN<input type="number" min="0" step="0.01" value={form.oldPriceBgn} onChange={(event) => update("oldPriceBgn", event.target.value)} /></label><label>Промо етикет<input placeholder="напр. -12%" value={form.discountLabel} onChange={(event) => update("discountLabel", event.target.value)} /></label></div><label>Описание<textarea required value={form.description} onChange={(event) => update("description", event.target.value)} /></label><div className="admin-form-grid"><label>Основна снимка – URL<input required value={form.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} /></label><label>Alt текст<input required value={form.imageAlt} onChange={(event) => update("imageAlt", event.target.value)} /></label></div><div className="admin-upload-row"><label className="admin-upload"><ImagePlus size={17} /><span>{uploadImage.isPending ? "Качване..." : "Качи JPG / PNG / WEBP"}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} disabled={uploadImage.isPending} /></label><small>Изображенията се съхраняват защитено в S3. Максимален размер: 4 MB.</small></div><div className="admin-form-grid"><label>Галерия – по един URL на ред<textarea required value={form.galleryText} onChange={(event) => update("galleryText", event.target.value)} /></label><label>Характеристики – по една на ред<textarea value={form.featuresText} onChange={(event) => update("featuresText", event.target.value)} /></label></div><label className="admin-checkbox"><input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} /> Публикуван в публичния каталог</label><div className="admin-form-actions"><button type="submit" className="admin-primary" disabled={saving}>{saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} {saving ? "Записване..." : "Запази артикула"}</button>{(createProduct.error || updateProduct.error) && <p className="admin-form-error">Неуспешен запис. Проверете уникалността на URL адреса и задължителните полета.</p>}</div></form></section>
    <section className="admin-panel"><div className="admin-panel-head"><div><p className="admin-kicker">ПУБЛИЧЕН КАТАЛОГ</p><h2>Артикули</h2></div><label className="admin-search">Търсене<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="име, марка, код" /></label></div>{productsQuery.isLoading ? <LoadingState /> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Артикул</th><th>Категория</th><th>Цена</th><th>Наличност</th><th>Статус</th><th /></tr></thead><tbody>{visibleProducts.map((product) => <tr key={product.id}><td><div className="admin-product-cell"><img src={product.image} alt="" /><span><b>{product.name}</b><small>{product.brand ?? "Без марка"}{product.sku ? ` · ${product.sku}` : ""}</small></span></div></td><td>{product.categoryName}</td><td>{product.price ?? "Запитване"}</td><td><span className={`admin-status availability-${product.availabilityCode}`}>{product.availability}</span></td><td>{product.isActive ? "Публикуван" : "Архивиран"}</td><td><button type="button" className="admin-text-action" onClick={() => edit(product)}>Редакция <ArrowUpRight size={15} /></button></td></tr>)}</tbody></table>{!visibleProducts.length && <EmptyState icon={Boxes} title="Няма намерени артикули." text="Променете търсенето или добавете първия нов артикул." />}</div>}</section>
  </section>;
}

function AdminCategories() {
  const utils = trpc.useUtils();
  const categories = trpc.admin.categories.useQuery();
  const save = trpc.admin.saveCategory.useMutation({ onSuccess: async () => { await Promise.all([utils.admin.categories.invalidate(), utils.catalogue.list.invalidate()]); toast("Категорията е записана."); } });
  const [form, setForm] = useState<CategoryForm>(emptyCategoryForm());
  function update<K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function edit(category: NonNullable<typeof categories.data>[number]) { setForm({ id: category.id, slug: category.slug, name: category.label, description: category.description, imageUrl: category.image, icon: category.icon, subcategoriesText: category.subcategories.join("\n"), sortOrder: String(category.sortOrder), isActive: category.isActive }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function submit(event: FormEvent) { event.preventDefault(); save.mutate({ id: form.id, category: { slug: form.slug.trim(), name: form.name.trim(), description: form.description.trim(), imageUrl: form.imageUrl.trim(), icon: form.icon.trim(), subcategories: textLines(form.subcategoriesText), sortOrder: Math.max(0, Number(form.sortOrder) || 0), isActive: form.isActive } }); }
  return <section className="admin-workspace"><ShellHeading section="КАТЕГОРИИ" title="Структура на каталога" text="Поддържайте категориите, визуалните им записи и работните подкатегории, които клиентите виждат в навигацията." action={<button type="button" className="admin-primary" onClick={() => setForm(emptyCategoryForm())}><Plus size={17} /> Нова категория</button>} />
    <section className="admin-edit-panel"><div className="admin-panel-head"><div><p className="admin-kicker">{form.id ? "РЕДАКЦИЯ" : "НОВ ЗАПИС"}</p><h2>{form.id ? form.name : "Нова категория"}</h2></div></div><form className="admin-form" onSubmit={submit}><div className="admin-form-grid"><label>Име<input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label><label>URL адрес (slug)<input required pattern="[a-z0-9-]+" value={form.slug} onChange={(event) => update("slug", event.target.value.toLowerCase())} /></label><label>Икона<select value={form.icon} onChange={(event) => update("icon", event.target.value)}>{["drill", "trees", "house", "bath", "lamp", "panels-top-left", "waves", "lock-keyhole", "paint-roller", "brick-wall", "hard-hat"].map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select></label><label>Пореден номер<input type="number" min="0" value={form.sortOrder} onChange={(event) => update("sortOrder", event.target.value)} /></label></div><label>Описание<textarea required value={form.description} onChange={(event) => update("description", event.target.value)} /></label><div className="admin-form-grid"><label>URL на изображение<input required value={form.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} /></label><label>Подкатегории – по една на ред<textarea value={form.subcategoriesText} onChange={(event) => update("subcategoriesText", event.target.value)} /></label></div><label className="admin-checkbox"><input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} /> Активна в публичния каталог</label><div className="admin-form-actions"><button type="submit" className="admin-primary" disabled={save.isPending}>{save.isPending ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Запази категорията</button></div></form></section>
    <section className="admin-panel"><div className="admin-panel-head"><div><p className="admin-kicker">НАВИГАЦИЯ</p><h2>Активни записи</h2></div></div>{categories.isLoading ? <LoadingState /> : <div className="admin-category-grid">{(categories.data ?? []).map((category) => <article key={category.id}><img src={category.image} alt="" /><div><span>{category.isActive ? "Активна" : "Скрита"} · 0{category.sortOrder + 1}</span><h3>{category.label}</h3><p>{category.subcategories.length} подкатегории</p><button type="button" className="admin-text-action" onClick={() => edit(category)}>Редакция <ArrowUpRight size={15} /></button></div></article>)}</div>}</section>
  </section>;
}

function AdminOrders() {
  const utils = trpc.useUtils();
  const orders = trpc.admin.orders.useQuery();
  const update = trpc.admin.updateOrder.useMutation({ onSuccess: async () => { await Promise.all([utils.admin.orders.invalidate(), utils.admin.summary.invalidate()]); toast("Заявката е актуализирана."); } });
  return <section className="admin-workspace"><ShellHeading section="ЗАЯВКИ" title="Заявки за доставка" text="Тук се виждат заявките от публичната форма. Няма съхранени платежни данни и не се извършват онлайн плащания." />
    <section className="admin-panel"><div className="admin-panel-head"><div><p className="admin-kicker">ВХОДЯЩИ</p><h2>Работна опашка</h2></div><span className="admin-count">{orders.data?.length ?? 0} записа</span></div>{orders.isLoading ? <LoadingState /> : orders.data?.length ? <div className="admin-order-list">{orders.data.map((order) => <OrderCard key={order.id} order={order} busy={update.isPending} onSave={(status, adminNote) => update.mutate({ id: order.id, status, adminNote })} />)}</div> : <EmptyState icon={ClipboardList} title="Няма заявки за обработка." text="Новите заявки от публичната форма ще се показват тук с контактни данни, избран артикул и статус." />}</section>
  </section>;
}

function OrderCard({ order, busy, onSave }: { order: AdminOrder; busy: boolean; onSave: (status: OrderStatus, note: string | null) => void }) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [note, setNote] = useState(order.adminNote ?? "");
  return <article className="admin-order-card"><div className="admin-order-product"><img src={order.productImageUrl} alt="" /><div><p className="admin-kicker">{order.requestNumber}</p><h3>{order.productName}</h3><span>Количество: {order.quantity}{order.totalEur ? ` · ${Number(order.totalEur).toFixed(2)}€` : " · По запитване"}</span></div></div><div className="admin-order-contact"><b>{order.fullName}</b><a href={`mailto:${order.email}`}>{order.email}</a><a href={`tel:${order.phone.replace(/[^0-9+]/g, "")}`}>{order.phone}</a><span>{order.address}, {order.postcode} {order.city}</span><small>{formatDate(order.createdAt)}</small></div><div className="admin-order-actions"><label>Статус<select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>{(Object.keys(statusLabels) as OrderStatus[]).map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select></label><label>Вътрешна бележка<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="видимо само за администратори" /></label><button type="button" className="admin-primary" disabled={busy} onClick={() => onSave(status, note.trim() || null)}><Save size={16} /> Запази</button></div></article>;
}

function LoadingState() { return <div className="admin-loading"><Loader2 size={22} className="animate-spin" /> Зареждане на данни…</div>; }
function ErrorState() { return <div className="admin-error">Данните не могат да бъдат заредени в момента. Обновете страницата или проверете достъпа си.</div>; }
function EmptyState({ icon: Icon, title, text }: { icon: typeof Archive; title: string; text: string }) { return <div className="admin-empty"><Icon size={25} /><h3>{title}</h3><p>{text}</p></div>; }
function emptyProductForm(categoryId: number): ProductForm { return { categoryId, slug: "", sku: "", brand: "", name: "", description: "", imageUrl: "", galleryText: "", imageAlt: "", priceEur: "", priceBgn: "", oldPriceEur: "", oldPriceBgn: "", discountLabel: "", availability: "on_request", stockQuantity: "0", featuresText: "", isActive: true }; }
function emptyCategoryForm(): CategoryForm { return { slug: "", name: "", description: "", imageUrl: "", icon: "drill", subcategoriesText: "", sortOrder: "0", isActive: true }; }

function AdminWorkspace() {
  const [location] = useLocation();
  if (location === "/admin/products") return <AdminProducts />;
  if (location === "/admin/categories") return <AdminCategories />;
  if (location === "/admin/orders") return <AdminOrders />;
  return <AdminOverview />;
}

export default function Admin() {
  return <DashboardLayout><AdminWorkspace /></DashboardLayout>;
}
