/** Joan operations console: live store control without invented customer, sales, or stock data. */
import DashboardLayout from "@/components/DashboardLayout";
import AdminUsersRoles from "@/components/AdminUsersRoles";
import { trpc } from "@/lib/trpc";
import { latinPathToken, type CategoryNode } from "@/lib/categoryHierarchy";
import { canVisitAdminSection, firstAdminPath, hasPermission, type Permission } from "@shared/permissions";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BadgePercent,
  BookOpen,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  FileUp,
  Filter,
  History,
  ImagePlus,
  Loader2,
  MessageSquare,
  PackageCheck,
  PackageSearch,
  Plus,
  Save,
  Tags,
  Trash2,
  UsersRound,
} from "lucide-react";
import {
  GlobalWorkerOptions,
  getDocument,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
	YAxis,
} from "recharts";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

type Availability = "in_stock" | "on_request" | "out_of_stock";
type OrderStatus = "new" | "contacted" | "confirmed" | "closed" | "cancelled";
type ContactEnquiryStatus = "new" | "contacted" | "closed";
type TechnicalRow = { label: string; value: string };
type ProductForm = {
  id?: number;
  categoryId: number;
  slug: string;
  slugMode: "automatic" | "custom";
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoRobots: "index,follow" | "noindex,follow";
  sku: string;
  brand: string;
  name: string;
  description: string;
  imageUrl: string;
  galleryText: string;
  imageAlt: string;
  priceEur: string;
  oldPriceEur: string;
  discountLabel: string;
  availability: Availability;
  stockQuantity: string;
  technicalRows: TechnicalRow[];
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
type AdminProduct = {
  id: number;
  categoryId: number;
  categoryName: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoRobots: "index,follow" | "noindex,follow";
  sku?: string;
  brand?: string;
  name: string;
  image: string;
  gallery: string[];
  imageAlt: string;
  price?: string;
  oldPrice?: string;
  discount?: string;
  availability: string;
  availabilityCode?: Availability;
  stockQuantity?: number;
  features: string[];
  description: string;
  isActive: boolean;
};
type AdminOrderItem = {
  id: number;
  productName: string;
  quantity: number;
  priceEur: string | null;
  totalEur: string | null;
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
  region?: string | null;
  city: string;
  postcode: string;
  status: OrderStatus;
  adminNote: string | null;
  createdAt: Date;
  items?: AdminOrderItem[];
};
type AdminContactEnquiry = {
  id: number;
  referenceNumber: string;
  fullName: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: ContactEnquiryStatus;
  adminNote: string | null;
  createdAt: Date;
};
type AdminBrochure = {
  id: number;
  title: string;
  pageUrls: string[];
  pageCount: number;
  sourcePdfUrl: string | null;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

const statusLabels: Record<OrderStatus, string> = {
  new: "Нова",
  contacted: "Свързване",
  confirmed: "Потвърдена",
  closed: "Приключена",
  cancelled: "Отказана",
};
const contactEnquiryStatusLabels: Record<ContactEnquiryStatus, string> = {
  new: "Ново",
  contacted: "Свързване",
  closed: "Приключено",
};
const availabilityLabels: Record<Availability, string> = {
  in_stock: "На склад",
  on_request: "По запитване",
  out_of_stock: "Изчерпан",
};
const numericOrNull = (value: string) =>
  value.trim() === "" ? null : Number(value);
const textLines = (value: string) =>
  value
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);
const parseTechnicalRows = (features: string[]): TechnicalRow[] => {
  const rows = features.map(feature => {
    const match = feature.match(/^\s*(.+?)\s*(?:[-–—:]\s+|\s{2,})(.+?)\s*$/);
    return match ? { label: match[1].trim(), value: match[2].trim() } : { label: feature.trim(), value: "" };
  });
  return rows.length ? rows : [{ label: "", value: "" }];
};
const categoryTreeText = (
  nodes: CategoryNode[],
  trail: string[] = []
): string[] =>
  nodes.flatMap(node => {
    const path = [...trail, node.label];
    return [path.join(" > "), ...categoryTreeText(node.children ?? [], path)];
  });
const categoryTreeFromText = (value: string): CategoryNode[] => {
  const roots: CategoryNode[] = [];
  for (const line of textLines(value)) {
    const path = line
      .split(">")
      .map(part => part.trim())
      .filter(Boolean)
      .slice(0, 3);
    let level = roots;
    for (const label of path) {
      let node = level.find(
        item =>
          item.label.toLocaleLowerCase("bg") === label.toLocaleLowerCase("bg")
      );
      if (!node) {
        node = { label };
        level.push(node);
      }
      node.children ??= [];
      level = node.children;
    }
  }
  return roots;
};
const categoryNodeCount = (nodes: CategoryNode[]): number =>
  nodes.reduce(
    (total, node) => total + 1 + categoryNodeCount(node.children ?? []),
    0
  );
const formatDate = (value: Date | string) =>
  new Date(value).toLocaleString("bg-BG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const money = (value?: string) => value?.replace("€", "") ?? "";
const euro = (value: number) =>
  new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" }).format(
    value
  );

type StaffPermissionState = {
  permissions: readonly string[];
  canAccess: boolean;
};
type AdminPageProps = Pick<StaffPermissionState, "permissions">;

const can = (permissions: readonly string[], permission: Permission) =>
  hasPermission(permissions, permission);

function ReadOnlyBadge({ text = "Само преглед" }: { text?: string }) {
  return <span className="admin-count">{text}</span>;
}

function AccessDeniedState({ text = "Нямате права за тази административна секция." }: { text?: string }) {
  return (
    <section className="admin-workspace" role="alert">
      <div className="admin-error">
        <b>Достъпът е ограничен.</b> {text}
      </div>
    </section>
  );
}

GlobalWorkerOptions.workerSrc = pdfWorker;

function ShellHeading({
  section,
  title,
  text,
  action,
}: {
  section: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="admin-heading">
      <div>
        <p className="admin-kicker">ЖОАН · {section}</p>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </header>
  );
}

function AdminOverview({ permissions }: AdminPageProps) {
  const canDashboard = can(permissions, "dashboard.read");
  const canCreateProducts = can(permissions, "products.write");
  const summary = trpc.admin.summary.useQuery(undefined, { enabled: canDashboard });
  const operations = trpc.admin.operations.useQuery(undefined, { enabled: canDashboard });
  if (summary.isLoading || operations.isLoading) return <LoadingState />;
  if (!summary.data || !operations.data) return <ErrorState />;
  const metrics = operations.data.metrics;
  const cards = [
    {
      label: "Публикувани артикули",
      value: metrics.activeProducts,
      detail: "каталог",
      icon: Boxes,
      href: "/admin/products",
    },
    {
      label: "Контрол на наличности",
      value: metrics.stockAttention,
      detail: "за проверка",
      icon: PackageSearch,
      href: "/admin/inventory",
    },
    {
      label: "Активни промоции",
      value: metrics.promotions,
      detail: "ценови записи",
      icon: BadgePercent,
      href: "/admin/promotions",
    },
    {
      label: "Отворени заявки",
      value: metrics.openRequests,
      detail: "работна опашка",
      icon: ClipboardList,
      href: "/admin/orders",
    },
  ];
  const reportPeriods = [
    { key: "today", label: "Днес" },
    { key: "week", label: "Тази седмица" },
    { key: "month", label: "Този месец" },
    { key: "year", label: "Тази година" },
  ] as const;
  return (
    <section className="admin-workspace">
      <ShellHeading
        section="ОБЗОР"
        title="Оперативен контролен център"
        text="Ежедневен преглед на каталога, наличностите, промоциите и заявките за потвърждение."
        action={
          canCreateProducts ? (
            <button
              className="admin-primary"
              type="button"
              onClick={() => {
                window.location.href = "/admin/products";
              }}
            >
              <Plus size={17} /> Нов артикул
            </button>
          ) : undefined
        }
      />
      <div className="admin-stat-grid">
        {cards.map(card => (
          <button
            key={card.label}
            type="button"
            className="admin-stat-card"
            onClick={() => {
              window.location.href = card.href;
            }}
          >
            <card.icon size={21} />
            <span>{card.label}</span>
            <b>{card.value}</b>
            <small>{card.detail}</small>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      <AdminReportingCharts
        daily={operations.data.reporting.charts.daily}
        monthly={operations.data.reporting.charts.monthly}
      />
      <section className="admin-panel admin-reporting-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">ЗАЯВКИ И СТОЙНОСТИ</p>
            <h2>Дневен, седмичен, месечен и годишен преглед</h2>
            <p className="admin-report-caption">
              Календарните периоди са по {operations.data.reporting.timeZone}.
              Стойностите са от подадени заявки и не представляват отчетена
              печалба или платен оборот.
            </p>
          </div>
          <button
            type="button"
            className="admin-text-action"
            onClick={() => {
              window.location.href = "/admin/orders";
            }}
          >
            Всички заявки <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="admin-report-grid">
          {reportPeriods.map(({ key, label }) => (
            <AdminReportCard
              key={key}
              label={label}
              report={operations.data.reporting.periods[key]}
            />
          ))}
        </div>
        <p className="admin-report-disclosure">
          <b>Печалба: няма налични данни.</b> За изчисляване на печалба са нужни
          потвърдени плащания, разход за доставка и себестойност, които не се
          съхраняват в текущия поток на заявки.
        </p>
      </section>
      <section className="admin-command-strip">
        <div>
          <span>01</span>
          <p>
            <b>КАЧЕСТВО НА КАТАЛОГА</b>
            {metrics.catalogueIssues
              ? `${metrics.catalogueIssues} записа имат нужда от допълване.`
              : "Няма открити записи за допълване."}
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/admin/products";
            }}
          >
            Преглед <ArrowUpRight size={14} />
          </button>
        </div>
        <div>
          <span>02</span>
          <p>
            <b>НАЛИЧНОСТИ</b>
            {metrics.stockAttention
              ? `${metrics.stockAttention} артикула са в контролна зона.`
              : "Няма артикули за незабавна проверка."}
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/admin/inventory";
            }}
          >
            Отвори <ArrowUpRight size={14} />
          </button>
        </div>
        <div>
          <span>03</span>
          <p>
            <b>ЗАЯВКИ</b>
            {summary.data.newOrders
              ? `${summary.data.newOrders} нови заявки очакват обработка.`
              : "Няма нови заявки в момента."}
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/admin/orders";
            }}
          >
            Опашка <ArrowUpRight size={14} />
          </button>
        </div>
      </section>
      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <p className="admin-kicker">ВНИМАНИЕ</p>
              <h2>Каталожна проверка</h2>
            </div>
            <button
              type="button"
              className="admin-text-action"
              onClick={() => {
                window.location.href = "/admin/products";
              }}
            >
              Към артикули <ArrowUpRight size={16} />
            </button>
          </div>
          {operations.data.qualityQueue.length ? (
            <div className="admin-alert-list">
              {operations.data.qualityQueue.slice(0, 5).map(product => (
                <div key={product.id}>
                  <AlertTriangle size={17} />
                  <span>
                    <b>{product.name}</b>
                    <small>{product.issues.join(" · ")}</small>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = "/admin/products";
                    }}
                  >
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="Каталогът е без видими пропуски."
              text="Контролът следи цена, код, галерия и характеристики на активните записи."
            />
          )}
        </section>
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <p className="admin-kicker">ПОСЛЕДНА АКТИВНОСТ</p>
              <h2>Одитна следа</h2>
            </div>
            <button
              type="button"
              className="admin-text-action"
              onClick={() => {
                window.location.href = "/admin/activity";
              }}
            >
              Всички действия <ArrowUpRight size={16} />
            </button>
          </div>
          {operations.data.activities.length ? (
            <div className="admin-activity-list">
              {operations.data.activities.slice(0, 5).map(activity => (
                <ActivityLine key={activity.id} activity={activity} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={History}
              title="Няма регистрирана активност."
              text="Съществените промени по магазинните записи ще се покажат тук."
            />
          )}
        </section>
      </div>
    </section>
  );
}

function AdminReportCard({
  label,
  report,
}: {
  label: string;
  report: {
    requestCount: number;
    activeRequestCount: number;
    requestedValueEur: number;
    confirmedRequestValueEur: number;
    statusCounts: Record<OrderStatus, number>;
  };
}) {
  return (
    <article className="admin-report-card">
      <span>{label}</span>
      <b>{report.requestCount}</b>
      <small>получени заявки · {report.activeRequestCount} активни</small>
      <dl>
        <div>
          <dt>Стойност на заявки</dt>
          <dd>{euro(report.requestedValueEur)}</dd>
        </div>
        <div>
          <dt>Потвърдени заявки</dt>
          <dd>{euro(report.confirmedRequestValueEur)}</dd>
        </div>
      </dl>
      <p>
        <em>Нови {report.statusCounts.new}</em>
        <em>Контакт {report.statusCounts.contacted}</em>
        <em>Потв. {report.statusCounts.confirmed}</em>
        <em>Прикл. {report.statusCounts.closed}</em>
      </p>
    </article>
  );
}

type AdminChartPoint = {
  key: string;
  label: string;
  requestCount: number;
  requestedValueEur: number;
  confirmedRequestValueEur: number;
};
function AdminReportingCharts({
  daily,
  monthly,
}: {
  daily: AdminChartPoint[];
  monthly: AdminChartPoint[];
}) {
  const tooltip = (value: number | string, name: string) => [
    name === "Заявки" ? value : euro(Number(value)),
    name,
  ];
  return (
    <section
      className="admin-chart-section"
      aria-labelledby="admin-chart-title"
    >
      <div className="admin-panel-head">
        <div>
          <p className="admin-kicker">ИНТЕРАКТИВЕН ПРЕГЛЕД</p>
          <h2 id="admin-chart-title">Динамика на заявките</h2>
          <p className="admin-report-caption">
            Посочете период от графиката за точна стойност. „Стойност на заявки“
            изключва отменените записи и не е отчетен приход.
          </p>
        </div>
      </div>
      <div className="admin-chart-grid">
        <article className="admin-chart-card">
          <div>
            <h3>Заявки по дни</h3>
            <p>Последни 14 календарни дни</p>
          </div>
          <div
            className="admin-chart-canvas"
            aria-label="Стълбовидна графика за броя заявки по дни"
          >
            <ResponsiveContainer width="100%" height={270}>
              <BarChart
                data={daily}
                margin={{ top: 14, right: 10, left: -18, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#e2e6df" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#677171", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#677171", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(215,25,32,.06)" }}
                  formatter={tooltip}
                  labelFormatter={label => `Дата: ${label}`}
                />
                <Bar
                  dataKey="requestCount"
                  name="Заявки"
                  fill="#d71920"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="admin-chart-card">
          <div>
            <h3>Стойност на заявки по месеци</h3>
            <p>Последни 12 календарни месеца</p>
          </div>
          <div
            className="admin-chart-canvas"
            aria-label="Линейна графика за стойността на заявки по месеци"
          >
            <ResponsiveContainer width="100%" height={270}>
              <LineChart
                data={monthly}
                margin={{ top: 14, right: 10, left: 8, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#e2e6df" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#677171", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "#677171", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={value => `${value}€`}
                  width={38}
                />
                <Tooltip
                  formatter={tooltip}
                  labelFormatter={label => `Период: ${label}`}
                />
                <Legend
                  wrapperStyle={{ fontFamily: "Manrope", fontSize: "11px" }}
                />
                <Line
                  type="monotone"
                  dataKey="requestedValueEur"
                  name="Стойност на заявки"
                  stroke="#d71920"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#d71920" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="confirmedRequestValueEur"
                  name="Потвърдени заявки"
                  stroke="#347b59"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#347b59" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
    </section>
  );
}

function AdminProducts({ permissions }: AdminPageProps) {
  const utils = trpc.useUtils();
  const canReadProducts = can(permissions, "products.read");
  const canWriteProducts = can(permissions, "products.write");
  const canReadCategories = can(permissions, "categories.read");
  const productsQuery = trpc.admin.products.useQuery(undefined, { enabled: canReadProducts });
  const categoriesQuery = trpc.admin.categories.useQuery(undefined, { enabled: canReadCategories });
  const operations = trpc.admin.operations.useQuery(undefined, { enabled: canReadProducts });
  const uploadImage = trpc.admin.uploadProductImage.useMutation();
  const onSaved = async (message: string) => {
    await Promise.all([
      utils.admin.products.invalidate(),
      utils.admin.operations.invalidate(),
      utils.catalogue.list.invalidate(),
    ]);
    toast(message);
  };
  const createProduct = trpc.admin.createProduct.useMutation({
    onSuccess: () => onSaved("Артикулът е добавен."),
    onError: error => toast.error(error.message),
  });
  const updateProduct = trpc.admin.updateProduct.useMutation({
    onSuccess: () => onSaved("Промените са записани."),
    onError: error => toast.error(error.message),
  });
  const [form, setForm] = useState<ProductForm>(() => emptyProductForm(0));
  const [search, setSearch] = useState("");
  const [qualityOnly, setQualityOnly] = useState(false);
  const [page, setPage] = useState(1);
  const categoryOptions = useMemo(() => {
    if (canReadCategories) return (categoriesQuery.data ?? []).map(category => ({ id: category.id, label: category.label }));
    const derived = new Map<number, { id: number; label: string }>();
    (productsQuery.data ?? []).forEach(product => {
      if (!derived.has(product.categoryId)) derived.set(product.categoryId, { id: product.categoryId, label: product.categoryName });
    });
    return Array.from(derived.values());
  }, [canReadCategories, categoriesQuery.data, productsQuery.data]);
  const canEditProductForm = canWriteProducts && canReadCategories;
  useEffect(() => {
    if (form.categoryId === 0 && categoryOptions[0])
      setForm(emptyProductForm(categoryOptions[0].id));
  }, [categoryOptions, form.categoryId]);
  const issueIds = useMemo(
    () =>
      new Set(operations.data?.qualityQueue.map(product => product.id) ?? []),
    [operations.data]
  );
  const visibleProducts = useMemo(
    () =>
      (productsQuery.data ?? []).filter(
        product =>
          `${product.name} ${product.brand ?? ""} ${product.sku ?? ""}`
            .toLocaleLowerCase("bg")
            .includes(search.toLocaleLowerCase("bg")) &&
          (!qualityOnly || issueIds.has(product.id))
      ),
    [productsQuery.data, search, qualityOnly, issueIds]
  );
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageProducts = visibleProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const saving = createProduct.isPending || updateProduct.isPending;
  const suggestedSlug = form.name.trim() ? latinPathToken(form.name) : "";
  const galleryUrls = textLines(form.galleryText).slice(0, 10);
  const incompleteTechnicalRows = form.technicalRows.some(
    row => Boolean(row.label.trim()) !== Boolean(row.value.trim())
  );
  function update<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }
  function updateTechnicalRow(index: number, key: keyof TechnicalRow, value: string) {
    update("technicalRows", form.technicalRows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  }
  function removeGalleryImage(url: string) {
    const nextGallery = galleryUrls.filter(item => item !== url);
    update("galleryText", nextGallery.join("\n"));
    update("imageUrl", nextGallery[0] ?? "");
  }
  function edit(product: AdminProduct) {
    setForm({
      id: product.id,
      categoryId: product.categoryId,
      slug: product.slug,
      slugMode: "custom",
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      seoKeywords: product.seoKeywords,
      seoRobots: product.seoRobots,
      sku: product.sku ?? "",
      brand: product.brand ?? "",
      name: product.name,
      description: product.description,
      imageUrl: product.image,
      galleryText: product.gallery.join("\n"),
      imageAlt: product.imageAlt,
      priceEur: money(product.price),
      oldPriceEur: money(product.oldPrice),
      discountLabel: product.discount ?? "",
      availability: product.availabilityCode ?? "on_request",
      stockQuantity: String(product.stockQuantity ?? 0),
      technicalRows: parseTechnicalRows(product.features),
      isActive: product.isActive,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canEditProductForm) return;
    if (!galleryUrls.length) {
      toast.error("Добавете поне една снимка на артикула.");
      return;
    }
    if (incompleteTechnicalRows) {
      toast.error("Попълнете и параметър, и стойност за всеки технически ред.");
      return;
    }
    const payload = {
      categoryId: form.categoryId,
      slug: form.slug.trim(),
      seoTitle: form.seoTitle.trim() || null,
      seoDescription: form.seoDescription.trim() || null,
      seoKeywords: form.seoKeywords.trim() || null,
      seoRobots: form.seoRobots,
      sku: form.sku.trim() || null,
      brand: form.brand.trim() || null,
      name: form.name.trim(),
      description: form.description.trim(),
      imageUrl: galleryUrls[0] ?? form.imageUrl.trim(),
      gallery: galleryUrls,
      imageAlt: form.imageAlt.trim(),
      priceEur: numericOrNull(form.priceEur),
      oldPriceEur: numericOrNull(form.oldPriceEur),
      discountLabel: form.discountLabel.trim() || null,
      availability: form.availability,
      stockQuantity: Math.max(0, Number(form.stockQuantity) || 0),
      features: form.technicalRows.filter(row => row.label.trim() && row.value.trim()).map(row => `${row.label.trim()} — ${row.value.trim()}`),
      isActive: form.isActive,
    };
    if (form.id) updateProduct.mutate({ id: form.id, product: payload });
    else createProduct.mutate(payload);
  }
  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || !canWriteProducts) return;
    if (files.length > 10) {
      toast.error("Можете да качите най-много 10 снимки наведнъж.");
      return;
    }
    const accepted = files.filter(file => /^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= 10 * 1024 * 1024);
    if (accepted.length !== files.length) {
      toast.error("Използвайте само JPG, PNG или WEBP снимки до 10 MB всяка.");
      return;
    }
    try {
      const stored = [] as Array<{ url: string }>;
      for (const file of accepted) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("read"));
          reader.readAsDataURL(file);
        });
        stored.push(await uploadImage.mutateAsync({ dataUrl, fileName: file.name }));
      }
      const gallery = [...textLines(form.galleryText), ...stored.map(item => item.url)].filter((url, index, all) => all.indexOf(url) === index).slice(0, 10);
      update("imageUrl", gallery[0] ?? "");
      update("galleryText", gallery.join("\n"));
      if (!form.imageAlt.trim()) update("imageAlt", accepted[0]?.name.replace(/\.[^.]+$/, "") ?? "Продукт ЖОАН");
      toast.success(`${stored.length} ${stored.length === 1 ? "снимка е качена" : "снимки са качени"}.`);
    } catch {
      toast.error("Качването прекъсна. Проверете снимките и опитайте отново.");
    }
  }
  return (
    <section className="admin-workspace">
      <ShellHeading
        section="АРТИКУЛИ"
        title="Каталог и качество"
        text="Поддържайте продуктова информация, визуални материали, цени, SEO и публикуване с контроли за качеството на записа."
        action={
          canWriteProducts ? (
            <button
              type="button"
              className="admin-primary"
              disabled={!canReadCategories || !categoryOptions.length}
              onClick={() =>
                setForm(emptyProductForm(categoryOptions[0]?.id ?? 0))
              }
            >
              <Plus size={17} /> Нов артикул
            </button>
          ) : (
            <ReadOnlyBadge />
          )
        }
      />
      <section className="admin-edit-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">
              {form.id ? "РЕДАКЦИЯ НА ЗАПИС" : "НОВ ЗАПИС"}
            </p>
            <h2>{form.id ? form.name || "Артикул" : "Нов артикул"}</h2>
          </div>
          {form.id && (
            <button
              type="button"
              className="admin-text-action"
              onClick={() =>
                setForm(emptyProductForm(categoryOptions[0]?.id ?? 0))
              }
            >
              <Trash2 size={15} /> Откажи редакцията
            </button>
          )}
        </div>
        <form className="admin-form" onSubmit={submit}>
          <fieldset disabled={!canEditProductForm}>
          <div className="admin-form-grid">
            <label>
              Име
              <input
                required
                value={form.name}
                onChange={event => {
                  update("name", event.target.value);
                  if (!form.id && form.slugMode === "automatic")
                    update(
                      "slug",
                      event.target.value.trim()
                        ? latinPathToken(event.target.value)
                        : ""
                    );
                }}
              />
            </label>
            <label>
              Категория
              <select
                required
                value={form.categoryId}
                onChange={event =>
                  update("categoryId", Number(event.target.value))
                }
              >
                {categoryOptions.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Марка
              <input
                value={form.brand}
                onChange={event => update("brand", event.target.value)}
              />
            </label>
            <label>
              Вътрешен код
              <input
                value={form.sku}
                onChange={event => update("sku", event.target.value)}
              />
            </label>
            <label>
              Наличност <small>ERP готово поле</small>
              <select
                value={form.availability}
                onChange={event =>
                  update("availability", event.target.value as Availability)
                }
              >
                {(Object.keys(availabilityLabels) as Availability[]).map(
                  availability => (
                    <option key={availability} value={availability}>
                      {availabilityLabels[availability]}
                    </option>
                  )
                )}
              </select>
            </label>
            <label>
              Количество <small>временно до ERP връзката</small>
              <input
                type="number"
                min="0"
                value={form.stockQuantity}
                onChange={event => update("stockQuantity", event.target.value)}
              />
            </label>
            <label>
              Цена EUR
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.priceEur}
                onChange={event => update("priceEur", event.target.value)}
              />
            </label>
            <label>
              Стара цена EUR
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.oldPriceEur}
                onChange={event => update("oldPriceEur", event.target.value)}
              />
            </label>
            <label>
              Промо етикет
              <input
                placeholder="напр. -12%"
                value={form.discountLabel}
                onChange={event => update("discountLabel", event.target.value)}
              />
            </label>
          </div>
          <section
            className="admin-seo-panel"
            aria-labelledby="admin-product-seo-title"
          >
            <div>
              <p className="admin-kicker">SEO КОНТРОЛ</p>
              <h3 id="admin-product-seo-title">Публичен адрес и търсачки</h3>
              <p>
                Canonical адресът се създава при нов продукт и остава постоянен
                след публикуване.
              </p>
            </div>
            {form.id ? (
              <p className="admin-seo-note">
                Адресът е заключен за запазване на външни връзки и натрупан SEO
                сигнал.
              </p>
            ) : (
              <div
                className="admin-seo-choices"
                role="radiogroup"
                aria-label="Начин за създаване на product slug"
              >
                <label>
                  <input
                    type="radio"
                    name="slug-mode"
                    checked={form.slugMode === "automatic"}
                    onChange={() => {
                      update("slugMode", "automatic");
                      if (suggestedSlug) update("slug", suggestedSlug);
                    }}
                  />{" "}
                  Автоматично от името
                </label>
                <label>
                  <input
                    type="radio"
                    name="slug-mode"
                    checked={form.slugMode === "custom"}
                    onChange={() => update("slugMode", "custom")}
                  />{" "}
                  Избирам собствен slug
                </label>
              </div>
            )}
            <div className="admin-seo-slug-row">
              <label>
                Canonical product slug
                <input
                  required
                  pattern="[a-z0-9-]+"
                  value={form.slug}
                  readOnly={Boolean(form.id) || form.slugMode === "automatic"}
                  onChange={event =>
                    update("slug", event.target.value.toLowerCase())
                  }
                  aria-describedby="product-slug-help"
                />
              </label>
              {!form.id && (
                <button
                  type="button"
                  className="admin-secondary"
                  disabled={!suggestedSlug}
                  onClick={() => {
                    update("slugMode", "automatic");
                    update("slug", suggestedSlug);
                  }}
                >
                  Използвай предложение
                </button>
              )}
            </div>
            <small id="product-slug-help">
              Публичен адрес: <b>/product/{form.slug || "example-product"}</b>.
              Допускат се само малки латински букви, цифри и тирета.
            </small>
            <div className="admin-form-grid">
              <label>
                SEO заглавие <small>{form.seoTitle.length}/70</small>
                <input
                  maxLength={70}
                  placeholder={`${form.name || "Име на продукта"} | ЖОАН`}
                  value={form.seoTitle}
                  onChange={event => update("seoTitle", event.target.value)}
                />
              </label>
              <label>
                SEO описание <small>{form.seoDescription.length}/200</small>
                <textarea
                  maxLength={200}
                  placeholder="Кратко полезно описание за резултатите в търсачките."
                  value={form.seoDescription}
                  onChange={event =>
                    update("seoDescription", event.target.value)
                  }
                />
              </label>
              <label>
                Ключови думи <small>по избор · до 255 знака</small>
                <input
                  maxLength={255}
                  placeholder="напр. категория, марка, материал"
                  value={form.seoKeywords}
                  onChange={event => update("seoKeywords", event.target.value)}
                />
              </label>
              <label>
                Индексиране
                <select
                  value={form.seoRobots}
                  onChange={event =>
                    update(
                      "seoRobots",
                      event.target.value as ProductForm["seoRobots"]
                    )
                  }
                >
                  <option value="index,follow">Индексируем продукт</option>
                  <option value="noindex,follow">Скрит от търсачки</option>
                </select>
              </label>
            </div>
          </section>
          <section className="admin-product-section" aria-labelledby="product-content-title">
            <div className="admin-product-section-heading">
              <div><p className="admin-kicker">СЪДЪРЖАНИЕ</p><h3 id="product-content-title">Описание и технически данни</h3></div>
              <small>Видими за клиентите в продуктовата страница.</small>
            </div>
            <label>
              Описание
              <textarea required rows={5} value={form.description} onChange={event => update("description", event.target.value)} placeholder="Опишете продукта с кратки, ясни изречения." />
            </label>
            <div className="admin-technical-editor">
              <div className="admin-technical-heading">
                <div><b>Технически данни</b><small>Например: Височина · 190 см</small></div>
                <button type="button" className="admin-secondary" onClick={() => update("technicalRows", [...form.technicalRows, { label: "", value: "" }])}><Plus size={15} /> Добави ред</button>
              </div>
              <div className="admin-technical-table" role="table" aria-label="Технически данни">
                <div className="admin-technical-table-head" role="row"><span>Параметър</span><span>Стойност</span><span aria-hidden="true" /></div>
                {form.technicalRows.map((row, index) => (
                  <div className="admin-technical-row" role="row" key={`technical-row-${index}`}>
                    <input aria-label={`Параметър ${index + 1}`} placeholder="Височина" value={row.label} onChange={event => updateTechnicalRow(index, "label", event.target.value)} />
                    <input aria-label={`Стойност ${index + 1}`} placeholder="190 см" value={row.value} onChange={event => updateTechnicalRow(index, "value", event.target.value)} />
                    <button type="button" className="admin-icon-action" aria-label={`Премахни ред ${index + 1}`} disabled={form.technicalRows.length === 1} onClick={() => update("technicalRows", form.technicalRows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="admin-product-section" aria-labelledby="product-images-title">
            <div className="admin-product-section-heading">
              <div><p className="admin-kicker">МЕДИЯ</p><h3 id="product-images-title">Снимки на артикула</h3></div>
              <small>{galleryUrls.length}/10 снимки · първата е основна</small>
            </div>
            <div className="admin-upload-row admin-upload-row-large">
              <label className="admin-upload admin-upload-large">
                <ImagePlus size={20} />
                <span>{uploadImage.isPending ? "Качване на снимките..." : "Избери до 10 снимки"}<small>JPG, PNG или WEBP · до 10 MB всяка</small></span>
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} disabled={!canWriteProducts || uploadImage.isPending || galleryUrls.length >= 10} />
              </label>
              <p>Снимките се качват наведнъж и се подреждат автоматично. Кликнете „Премахни“, ако искате да замените някоя.</p>
            </div>
            {galleryUrls.length ? (
              <div className="admin-gallery-preview">
                {galleryUrls.map((url, index) => (
                  <figure key={url} className={index === 0 ? "is-primary" : ""}>
                    <img src={url} alt={form.imageAlt || `Снимка ${index + 1}`} />
                    <figcaption>{index === 0 ? "Основна снимка" : `Снимка ${index + 1}`}<button type="button" onClick={() => removeGalleryImage(url)}>Премахни</button></figcaption>
                  </figure>
                ))}
              </div>
            ) : <div className="admin-gallery-empty"><ImagePlus size={24} /><span>Още няма добавени снимки. Добавете поне една, за да запазите артикула.</span></div>}
            <div className="admin-form-grid admin-media-meta">
              <label>
                Alt текст на снимките
                <input required value={form.imageAlt} onChange={event => update("imageAlt", event.target.value)} placeholder="Например: Косачка TIMMER 450 мм" />
              </label>
              <label>
                Ръчно добавяне на URL <small>по избор</small>
                <textarea rows={3} value={form.galleryText} onChange={event => { const urls = textLines(event.target.value).slice(0, 10); update("galleryText", urls.join("\n")); update("imageUrl", urls[0] ?? ""); }} placeholder="Използвайте само ако вече имате managed URL-и, по един на ред." />
              </label>
            </div>
          </section>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={event => update("isActive", event.target.checked)}
            />{" "}
            Публикуван в публичния каталог
          </label>
          <div className="admin-form-actions">
            {canWriteProducts && <button type="submit" className="admin-primary" disabled={saving || !canEditProductForm}>
              {saving ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}{" "}
              {saving ? "Записване..." : "Запази артикула"}
            </button>}
            {!canWriteProducts && <ReadOnlyBadge text="Само преглед · редакцията е недостъпна" />}
            {(createProduct.error || updateProduct.error) && (
              <p className="admin-form-error">
                {createProduct.error?.message || updateProduct.error?.message}
              </p>
            )}
          </div>
          </fieldset>
        </form>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">ПУБЛИЧЕН КАТАЛОГ</p>
            <h2>Артикули и контрол на качеството</h2>
          </div>
          <div className="admin-table-controls">
            <label className="admin-search">
              Търсене
              <input
                value={search}
                onChange={event => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="име, марка, код"
              />
            </label>
            <button
              type="button"
              className={`admin-filter-button ${qualityOnly ? "is-active" : ""}`}
              onClick={() => {
                setQualityOnly(value => !value);
                setPage(1);
              }}
            >
              <Filter size={15} /> Нужда от проверка (
              {operations.data?.qualityQueue.length ?? 0})
            </button>
          </div>
        </div>
        {productsQuery.isLoading ? (
          <LoadingState />
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Артикул</th>
                    <th>Категория</th>
                    <th>Цена</th>
                    <th>Наличност</th>
                    <th>Качество</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pageProducts.map(product => (
                    <tr key={product.id}>
                      <td>
                        <div className="admin-product-cell">
                          <img src={product.image} alt="" />
                          <span>
                            <b>{product.name}</b>
                            <small>
                              {product.brand ?? "Без марка"}
                              {product.sku ? ` · ${product.sku}` : ""}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>{product.categoryName}</td>
                      <td>{product.price ?? "Запитване"}</td>
                      <td>
                        <span
                          className={`admin-status availability-${product.availabilityCode}`}
                        >
                          {product.availability} · {product.stockQuantity ?? 0}
                        </span>
                      </td>
                      <td>
                        {issueIds.has(product.id) ? (
                          <span className="admin-quality-flag">
                            <AlertTriangle size={13} /> Проверка
                          </span>
                        ) : (
                          <span className="admin-quality-good">
                            <CheckCircle2 size={13} /> Готов
                          </span>
                        )}
                      </td>
                      <td>
                        {canWriteProducts ? (
                          <button
                            type="button"
                            className="admin-text-action"
                            onClick={() => edit(product)}
                          >
                            Редакция <ArrowUpRight size={15} />
                          </button>
                        ) : (
                          <ReadOnlyBadge />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visibleProducts.length && (
                <EmptyState
                  icon={Boxes}
                  title="Няма намерени артикули."
                  text="Променете търсенето или филтрите за контрол."
                />
              )}
            </div>
            {visibleProducts.length > pageSize && (
              <nav
                className="catalogue-pagination"
                aria-label="Страници с администраторски артикули"
              >
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage(value => Math.max(1, value - 1))}
                >
                  Предишна
                </button>
                <span>
                  Страница <b>{currentPage}</b> от {totalPages} ·{" "}
                  {visibleProducts.length} записа
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setPage(value => Math.min(totalPages, value + 1))
                  }
                >
                  Следваща
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </section>
  );
}

function AdminInventory({ permissions }: AdminPageProps) {
  const utils = trpc.useUtils();
  const canReadInventory = can(permissions, "inventory.read");
  const canWriteInventory = can(permissions, "inventory.write");
  const operations = trpc.admin.operations.useQuery(undefined, { enabled: canReadInventory });
  const adjust = trpc.admin.adjustStock.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.operations.invalidate(),
        utils.admin.products.invalidate(),
        utils.admin.summary.invalidate(),
        utils.catalogue.list.invalidate(),
      ]);
      toast("Наличността е актуализирана.");
    },
  });
  if (operations.isLoading) return <LoadingState />;
  if (!operations.data) return <ErrorState />;
  return (
    <section className="admin-workspace">
      <ShellHeading
        section="НАЛИЧНОСТИ"
        title="Контрол на складови записи"
        text="Работна зона за бърза корекция на количества и преглед на артикули, които изискват внимание."
        action={!canWriteInventory ? <ReadOnlyBadge /> : undefined}
      />
      <section className="admin-inventory-summary">
        <div>
          <span>КОНТРОЛНА ЗОНА</span>
          <b>{operations.data.metrics.stockAttention}</b>
          <p>активни артикула с количество до 2</p>
        </div>
        <div>
          <span>НАЛИЧНИ НА СКЛАД</span>
          <b>
            {operations.data.metrics.activeProducts -
              operations.data.metrics.stockAttention}
          </b>
          <p>извън текущата контролна зона</p>
        </div>
        <div>
          <span>РАБОТНО ПРАВИЛО</span>
          <p>Всяка промяна се записва с администратор и час на операцията.</p>
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">ИНВЕНТАРНА ОПАШКА</p>
            <h2>Артикули за преглед</h2>
          </div>
          <span className="admin-count">
            {operations.data.inventoryQueue.length} записа
          </span>
        </div>
        {operations.data.inventoryQueue.length ? (
          <div className="admin-inventory-list">
            {operations.data.inventoryQueue.map(product => (
              <article key={product.id}>
                <img src={product.image} alt="" />
                <div>
                  <span
                    className={`admin-status availability-${product.availabilityCode}`}
                  >
                    {product.availability}
                  </span>
                  <h3>{product.name}</h3>
                  <p>
                    {product.category} · текущо количество:{" "}
                    <b>{product.stockQuantity ?? 0}</b>
                  </p>
                </div>
                <div className="admin-stock-stepper">
                  <button
                    type="button"
                    disabled={
                      !canWriteInventory || adjust.isPending || (product.stockQuantity ?? 0) === 0
                    }
                    onClick={() => {
                      if (canWriteInventory) adjust.mutate({ id: product.id, delta: -1 });
                    }}
                    aria-label={`Намали количество: ${product.name}`}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <b>{product.stockQuantity ?? 0}</b>
                  <button
                    type="button"
                    disabled={!canWriteInventory || adjust.isPending}
                    onClick={() => {
                      if (canWriteInventory) adjust.mutate({ id: product.id, delta: 1 });
                    }}
                    aria-label={`Увеличи количество: ${product.name}`}
                  >
                    <ArrowUp size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={PackageCheck}
            title="Няма артикули в контролна зона."
            text="Когато количество на активен артикул е до 2, той ще се покаже тук."
          />
        )}
      </section>
    </section>
  );
}

function AdminPromotions({ permissions }: AdminPageProps) {
  const canReadPromotions = can(permissions, "promotions.read");
  const canWritePromotions = can(permissions, "promotions.write");
  const operations = trpc.admin.operations.useQuery(undefined, { enabled: canReadPromotions });
  const productsQuery = trpc.admin.products.useQuery(undefined, { enabled: canReadPromotions });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const availableProducts = (productsQuery.data ?? []).filter(
    product => product.isActive && product.price
  );
  useEffect(() => {
    if (selectedId === null && availableProducts[0])
      setSelectedId(availableProducts[0].id);
  }, [availableProducts, selectedId]);
  const selected =
    availableProducts.find(product => product.id === selectedId) ?? null;
  if (operations.isLoading || productsQuery.isLoading) return <LoadingState />;
  if (!operations.data) return <ErrorState />;
  return (
    <section className="admin-workspace">
      <ShellHeading
        section="ПРОМОЦИИ"
        title="Цени и предложения"
        text="Поддържайте реални продуктови промоции с контрол над продажната и предишната цена."
      />
      <section className="admin-promotion-overview">
        <div>
          <BadgePercent size={23} />
          <span>АКТИВНИ ПРОМОЦИИ</span>
          <b>{operations.data.metrics.promotions}</b>
          <p>Показват се само записи с налична промоционална информация.</p>
        </div>
        <div>
          <AlertTriangle size={23} />
          <span>КАЧЕСТВО НА ЦЕНИТЕ</span>
          <b>
            {
              operations.data.qualityQueue.filter(product =>
                product.issues.includes("Липсва цена")
              ).length
            }
          </b>
          <p>Артикула са без цена и изискват допълване преди предложение.</p>
        </div>
      </section>
      {selected ? (
        <PromotionEditor product={selected} canWrite={canWritePromotions} />
      ) : (
        <EmptyState
          icon={BadgePercent}
          title="Няма артикули с въведена EUR цена."
          text="Добавете базова цена към артикул, преди да създадете промоция."
        />
      )}
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">ИЗБЕРЕТЕ АРТИКУЛ</p>
            <h2>Ценов контрол</h2>
          </div>
          <label className="admin-search">
            Търсене
            <select
              value={selectedId ?? ""}
              onChange={event => setSelectedId(Number(event.target.value))}
            >
              {availableProducts.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-promo-grid">
          {operations.data.promotions.length ? (
            operations.data.promotions.map(product => (
              <button
                type="button"
                key={product.id}
                className={`admin-promo-card ${selectedId === product.id ? "is-selected" : ""}`}
                onClick={() => {
                  setSelectedId(product.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <img src={product.image} alt="" />
                <span>{product.discount ?? "Промо"}</span>
                <b>{product.name}</b>
                <small>
                  {product.price}{" "}
                  {product.oldPrice && `· преди ${product.oldPrice}`}
                </small>
              </button>
            ))
          ) : (
            <EmptyState
              icon={BadgePercent}
              title="Няма активни промоции."
              text="Изберете артикул по-горе и въведете продажна, предишна цена и промо етикет."
            />
          )}
        </div>
      </section>
    </section>
  );
}

function PromotionEditor({ product, canWrite }: { product: AdminProduct; canWrite: boolean }) {
  const utils = trpc.useUtils();
  const save = trpc.admin.savePromotion.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.operations.invalidate(),
        utils.admin.products.invalidate(),
        utils.catalogue.list.invalidate(),
      ]);
      toast("Промоцията е записана.");
    },
  });
  const [form, setForm] = useState({
    priceEur: money(product.price),
    oldPriceEur: money(product.oldPrice),
    discountLabel: product.discount ?? "",
  });
  useEffect(
    () =>
      setForm({
        priceEur: money(product.price),
        oldPriceEur: money(product.oldPrice),
        discountLabel: product.discount ?? "",
      }),
    [product]
  );
  return (
    <section className="admin-edit-panel admin-promotion-editor">
      <div className="admin-panel-head">
        <div>
          <p className="admin-kicker">РЕДАКТОР НА ПРЕДЛОЖЕНИЕ</p>
          <h2>{product.name}</h2>
        </div>
        <span
          className={`admin-status availability-${product.availabilityCode}`}
        >
          {product.availability}
        </span>
      </div>
      <form
        className="admin-form"
        onSubmit={event => {
          event.preventDefault();
          if (!canWrite) return;
          save.mutate({
            id: product.id,
            priceEur: numericOrNull(form.priceEur),
            oldPriceEur: numericOrNull(form.oldPriceEur),
            discountLabel: form.discountLabel.trim() || null,
          });
        }}
      >
        <fieldset disabled={!canWrite}>
        <div className="admin-form-grid">
          <label>
            Продажна цена EUR
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={form.priceEur}
              onChange={event =>
                setForm({ ...form, priceEur: event.target.value })
              }
            />
          </label>
          <label>
            Предишна цена EUR
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.oldPriceEur}
              onChange={event =>
                setForm({ ...form, oldPriceEur: event.target.value })
              }
            />
          </label>
          <label>
            Промо етикет
            <input
              placeholder="напр. -15%"
              value={form.discountLabel}
              onChange={event =>
                setForm({ ...form, discountLabel: event.target.value })
              }
            />
          </label>
        </div>
        <div className="admin-form-actions">
          {canWrite && <button
            type="submit"
            className="admin-primary"
            disabled={save.isPending}
          >
            {save.isPending ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Save size={17} />
            )}{" "}
            Запази предложение
          </button>}
          {!canWrite && <ReadOnlyBadge text="Само преглед · промяната на цени е недостъпна" />}
        </div>
        </fieldset>
      </form>
    </section>
  );
}

function AdminCategories({ permissions }: AdminPageProps) {
  const utils = trpc.useUtils();
  const canReadCategories = can(permissions, "categories.read");
  const canWriteCategories = can(permissions, "categories.write");
  const categories = trpc.admin.categories.useQuery(undefined, { enabled: canReadCategories });
  const save = trpc.admin.saveCategory.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.categories.invalidate(),
        utils.catalogue.list.invalidate(),
        utils.admin.operations.invalidate(),
      ]);
      toast("Категорията е записана.");
    },
  });
  const [form, setForm] = useState<CategoryForm>(emptyCategoryForm());
  function update<K extends keyof CategoryForm>(
    key: K,
    value: CategoryForm[K]
  ) {
    setForm(current => ({ ...current, [key]: value }));
  }
  function edit(category: NonNullable<typeof categories.data>[number]) {
    setForm({
      id: category.id,
      slug: category.slug,
      name: category.label,
      description: category.description,
      imageUrl: category.image,
      icon: category.icon,
      subcategoriesText: categoryTreeText(category.subcategories).join("\n"),
      sortOrder: String(category.sortOrder),
      isActive: category.isActive,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <section className="admin-workspace">
      <ShellHeading
        section="КАТЕГОРИИ"
        title="Структура на каталога"
        text="Поддържайте категориите, визуалните им записи и работните подкатегории, които клиентите виждат в навигацията."
        action={
          canWriteCategories ? (
            <button
              type="button"
              className="admin-primary"
              onClick={() => setForm(emptyCategoryForm())}
            >
              <Plus size={17} /> Нова категория
            </button>
          ) : (
            <ReadOnlyBadge />
          )
        }
      />
      <section className="admin-edit-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">{form.id ? "РЕДАКЦИЯ" : "НОВ ЗАПИС"}</p>
            <h2>{form.id ? form.name : "Нова категория"}</h2>
          </div>
        </div>
        <form
          className="admin-form"
          onSubmit={event => {
            event.preventDefault();
            if (!canWriteCategories) return;
            save.mutate({
              id: form.id,
              category: {
                slug: form.slug.trim(),
                name: form.name.trim(),
                description: form.description.trim(),
                imageUrl: form.imageUrl.trim(),
                icon: form.icon.trim(),
                subcategories: categoryTreeFromText(form.subcategoriesText),
                sortOrder: Math.max(0, Number(form.sortOrder) || 0),
                isActive: form.isActive,
              },
            });
          }}
        >
          <fieldset disabled={!canWriteCategories}>
          <div className="admin-form-grid">
            <label>
              Име
              <input
                required
                value={form.name}
                onChange={event => update("name", event.target.value)}
              />
            </label>
            <label>
              URL адрес (slug)
              <input
                required
                pattern="[a-z0-9-]+"
                value={form.slug}
                onChange={event =>
                  update("slug", event.target.value.toLowerCase())
                }
              />
            </label>
            <label>
              Икона
              <select
                value={form.icon}
                onChange={event => update("icon", event.target.value)}
              >
                {[
                  "drill",
                  "trees",
                  "house",
                  "bath",
                  "lamp",
                  "panels-top-left",
                  "waves",
                  "lock-keyhole",
                  "paint-roller",
                  "brick-wall",
                  "hard-hat",
                ].map(icon => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Пореден номер
              <input
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={event => update("sortOrder", event.target.value)}
              />
            </label>
          </div>
          <label>
            Описание
            <textarea
              required
              value={form.description}
              onChange={event => update("description", event.target.value)}
            />
          </label>
          <div className="admin-form-grid">
            <label>
              URL на изображение
              <input
                required
                value={form.imageUrl}
                onChange={event => update("imageUrl", event.target.value)}
              />
            </label>
            <label>
              Подкатегории – по една на ред
              <textarea
                value={form.subcategoriesText}
                placeholder={
                  "Електроинструменти\nЕлектроинструменти > Бормашини\nРъчни инструменти\nРъчни инструменти > Бъркалки"
                }
                onChange={event =>
                  update("subcategoriesText", event.target.value)
                }
              />
              <small>
                Използвайте <b>&gt;</b> за подкатегория. Поддържат се до три
                нива.
              </small>
            </label>
          </div>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={event => update("isActive", event.target.checked)}
            />{" "}
            Активна в публичния каталог
          </label>
          <div className="admin-form-actions">
            {canWriteCategories && <button
              type="submit"
              className="admin-primary"
              disabled={save.isPending}
            >
              {save.isPending ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}{" "}
              Запази категорията
            </button>}
            {!canWriteCategories && <ReadOnlyBadge text="Само преглед · редакцията е недостъпна" />}
          </div>
          </fieldset>
        </form>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">НАВИГАЦИЯ</p>
            <h2>Активни записи</h2>
          </div>
        </div>
        {categories.isLoading ? (
          <LoadingState />
        ) : (
          <div className="admin-category-grid">
            {(categories.data ?? []).map(category => (
              <article key={category.id}>
                <img src={category.image} alt="" />
                <div>
                  <span>
                    {category.isActive ? "Активна" : "Скрита"} · 0
                    {category.sortOrder + 1}
                  </span>
                  <h3>{category.label}</h3>
                  <p>
                    {categoryNodeCount(category.subcategories)} навигационни
                    записа
                  </p>
                  {canWriteCategories ? (
                    <button
                      type="button"
                      className="admin-text-action"
                      onClick={() => edit(category)}
                    >
                      Редакция <ArrowUpRight size={15} />
                    </button>
                  ) : (
                    <ReadOnlyBadge />
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

function AdminOrders({ permissions }: AdminPageProps) {
  const canReadOrders = can(permissions, "orders.read");
  const orders = trpc.admin.orders.useQuery(undefined, { enabled: canReadOrders });
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const filtered = (orders.data ?? []).filter(
    order => filter === "all" || order.status === filter
  );
  const orderCounts = (orders.data ?? []).reduce<Record<OrderStatus, number>>((counts, order) => {
    counts[order.status] += 1;
    return counts;
  }, { new: 0, contacted: 0, confirmed: 0, closed: 0, cancelled: 0 });
  return (
    <section className="admin-workspace">
      <ShellHeading
        section="ЗАЯВКИ"
        title="Заявки за доставка"
        text="Отворете заявка, за да видите всички артикули и постоянната история на статусите и коментарите. Не се съхраняват платежни данни."
      />
      <section className="admin-order-status-strip">
        {(
          [
            "all",
            "new",
            "contacted",
            "confirmed",
            "closed",
            "cancelled",
          ] as const
        ).map(status => (
          <button
            key={status}
            type="button"
            className={filter === status ? "is-active" : ""}
            onClick={() => setFilter(status)}
          >
            <span>{status === "all" ? "Всички" : statusLabels[status]}</span>
            <b>
              {status === "all"
                ? (orders.data?.length ?? 0)
                : orderCounts[status]}
            </b>
          </button>
        ))}
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">ВХОДЯЩИ</p>
            <h2>Работна опашка</h2>
          </div>
          <span className="admin-count">{filtered.length} записа</span>
        </div>
        {orders.isLoading ? (
          <LoadingState />
        ) : filtered.length ? (
          <div className="admin-order-list">
            {filtered.map(order => (
              <OrderCard
                key={order.id}
                order={order}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="Няма заявки за избрания статус."
            text="Новите заявки от публичната форма ще се показват тук с контактни данни, избран артикул и статус."
          />
        )}
      </section>
    </section>
  );
}

function AdminContactEnquiries({ permissions }: AdminPageProps) {
  const utils = trpc.useUtils();
  const canReadEnquiries = can(permissions, "enquiries.read");
  const canWriteEnquiries = can(permissions, "enquiries.write");
  const enquiries = trpc.admin.contactEnquiries.useQuery(undefined, { enabled: canReadEnquiries });
  const update = trpc.admin.updateContactEnquiry.useMutation({
    onSuccess: async () => {
      await utils.admin.contactEnquiries.invalidate();
      toast("Запитването е актуализирано.");
    },
  });
  const [filter, setFilter] = useState<"all" | ContactEnquiryStatus>("all");
  const filtered = (enquiries.data ?? []).filter(
    enquiry => filter === "all" || enquiry.status === filter
  );
  return (
    <section className="admin-workspace">
      <ShellHeading
        section="ЗАПИТВАНИЯ"
        title="Контактна опашка"
        text="Съобщенията от страницата „Контакти“ се записват тук с номер, данни за връзка и вътрешна бележка."
        action={!canWriteEnquiries ? <ReadOnlyBadge /> : undefined}
      />
      <section className="admin-order-status-strip">
        {(["all", "new", "contacted", "closed"] as const).map(status => (
          <button
            key={status}
            type="button"
            className={filter === status ? "is-active" : ""}
            onClick={() => setFilter(status)}
          >
            <span>
              {status === "all" ? "Всички" : contactEnquiryStatusLabels[status]}
            </span>
            <b>
              {status === "all"
                ? (enquiries.data?.length ?? 0)
                : (enquiries.data ?? []).filter(
                    enquiry => enquiry.status === status
                  ).length}
            </b>
          </button>
        ))}
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">ВХОДЯЩИ ОТ КОНТАКТИ</p>
            <h2>Запитвания от сайта</h2>
          </div>
          <span className="admin-count">{filtered.length} записа</span>
        </div>
        {enquiries.isLoading ? (
          <LoadingState />
        ) : filtered.length ? (
          <div className="admin-order-list">
            {filtered.map(enquiry => (
              <ContactEnquiryCard
                key={enquiry.id}
                enquiry={enquiry}
                busy={update.isPending}
                canWrite={canWriteEnquiries}
                onSave={(status, note) => {
                  if (canWriteEnquiries) update.mutate({ id: enquiry.id, status, adminNote: note });
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="Няма запитвания за избрания статус."
            text="Нови съобщения от публичната форма „Контакти“ ще се показват тук."
          />
        )}
      </section>
    </section>
  );
}

function AdminCustomers({ permissions }: AdminPageProps) {
  const [workbookData, setWorkbookData] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const canReadCustomers = can(permissions, "customers.read");
  const canImportCustomers = can(permissions, "customers.import");
  const preview = trpc.admin.previewLegacyCustomerImport.useMutation({
    onError: error =>
      toast.error(error.message || "Файлът не може да бъде проверен."),
  });
  const importer = trpc.admin.importLegacyCustomers.useMutation({
    onSuccess: result => {
      setWorkbookData(null);
      setFileName("");
      toast.success(
        `Импортирани са ${result.importedProfiles} клиентски профила и ${result.importedAddresses} адреса.`
      );
    },
    onError: error => toast.error(error.message || "Импортът беше прекратен."),
  });
  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      (!/\.xlsx$/i.test(file.name) &&
        file.type !==
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ||
      file.size > 8 * 1024 * 1024
    ) {
      toast.error("Изберете Excel файл .xlsx до 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      setWorkbookData(value);
      setFileName(file.name);
      if (canReadCustomers) preview.mutate({ workbookData: value });
    };
    reader.readAsDataURL(file);
  }
  const isReady = Boolean(
    workbookData &&
      preview.data &&
      preview.data.duplicateEmailCount === 0 &&
      preview.data.missingRequiredFieldCount === 0
  );
  return (
    <section className="admin-workspace">
      <ShellHeading
        section="КЛИЕНТИ"
        title="Прехвърляне на клиентски профили"
        text="Проверете и импортирайте профили и адреси от OpenCart. Стари пароли, salt стойности и други password-related полета не се записват."
        action={!canImportCustomers ? <ReadOnlyBadge text="Само преглед · импортът е недостъпен" /> : undefined}
      />
      <section className="admin-edit-panel admin-customer-import">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">ЗАЩИТЕН ИМПОРТ</p>
            <h2>Customers + Addresses</h2>
          </div>
          <span className="admin-count">само администратор</span>
        </div>
        <p>
          Качете единствено файла <b>customers-YYYY-MM-DD.xlsx</b>. Системата
          анализира само профили и адреси, създава отделни клиентски записи и
          изисква нова парола при първо влизане.
        </p>
        <div className="admin-brochure-upload-zone">
          <UsersRound size={30} />
          <div>
            <b>{fileName || "Изберете OpenCart customer export"}</b>
            <p>
              Файлът не се публикува в сайта. Преди реалния импорт се показват
              единствено агрегирани проверки.
            </p>
          </div>
          <label className="admin-primary">
            <FileUp size={17} /> Избери Excel
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={selectFile}
              disabled={!canReadCustomers || preview.isPending || importer.isPending}
            />
          </label>
        </div>
        {preview.isPending && (
          <p className="admin-loading">
            <Loader2 size={18} className="animate-spin" /> Проверка на
            структурата…
          </p>
        )}
        {preview.data && (
          <div className="admin-customer-import-summary">
            <div>
              <span>Валидни профили</span>
              <b>{preview.data.customerCount}</b>
            </div>
            <div>
              <span>Адреси</span>
              <b>{preview.data.addressCount}</b>
            </div>
            <div>
              <span>За активиране</span>
              <b>{preview.data.activeAndApprovedCount}</b>
            </div>
            <div>
              <span>Деактивирани</span>
              <b>{preview.data.disabledCount}</b>
            </div>
            <div>
              <span>Дублирани имейли</span>
              <b>{preview.data.duplicateEmailCount}</b>
            </div>
            <div>
              <span>Непълни записи</span>
              <b>{preview.data.missingRequiredFieldCount}</b>
            </div>
          </div>
        )}
        {preview.data && !isReady && (
          <p className="admin-form-error">
            Импортът е блокиран: коригирайте дублираните или непълните записи в
            изходния Excel файл.
          </p>
        )}
        <div className="admin-form-actions">
          {canImportCustomers && <button
            type="button"
            className="admin-primary"
            disabled={!isReady || importer.isPending}
            onClick={() => {
              if (workbookData && canImportCustomers) importer.mutate({ workbookData });
            }}
          >
            {importer.isPending ? (
              <>
                <Loader2 size={17} className="animate-spin" /> Импортиране…
              </>
            ) : (
              <>
                <CheckCircle2 size={17} /> Импортирай проверените профили
              </>
            )}
          </button>}
          {!canImportCustomers && <ReadOnlyBadge text="Само преглед · импортът е недостъпен" />}
        </div>
      </section>
    </section>
  );
}

function AdminLegacyOrders({ permissions }: AdminPageProps) {
  const [csvData, setCsvData] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const canReadLegacyOrders = can(permissions, "legacy_orders.read");
  const canImportLegacyOrders = can(permissions, "legacy_orders.import");
  const preview = trpc.admin.previewLegacyOrderImport.useMutation({
    onError: error =>
      toast.error(
        error.message || "Файлът с поръчки не може да бъде проверен."
      ),
  });
  const importer = trpc.admin.importLegacyOrders.useMutation({
    onSuccess: result => {
      setCsvData(null);
      setFileName("");
      toast.success(
        `Импортирани са ${result.importedOrders} исторически поръчки и ${result.importedOrderLines} продуктови реда.`
      );
    },
    onError: error =>
      toast.error(
        error.message || "Импортът на исторически поръчки беше прекратен."
      ),
  });
  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      (!/\.csv$/i.test(file.name) && file.type !== "text/csv") ||
      file.size > 8 * 1024 * 1024
    ) {
      toast.error("Изберете CSV файл с поръчки до 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      setCsvData(value);
      setFileName(file.name);
      if (canReadLegacyOrders) preview.mutate({ csvData: value });
    };
    reader.readAsDataURL(file);
  }
  const isReady = Boolean(
    csvData && preview.data && preview.data.malformedRows === 0
  );
  return (
    <section className="admin-workspace">
      <ShellHeading
        section="ИСТОРИЧЕСКИ ПОРЪЧКИ"
        title="Прехвърляне на legacy поръчки"
        text="Мигрирайте одобрената история от OpenCart, без платежни данни, IP адреси, браузърна информация или коментари към плащането."
        action={!canImportLegacyOrders ? <ReadOnlyBadge text="Само преглед · импортът е недостъпен" /> : undefined}
      />
      <section className="admin-edit-panel admin-customer-import">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">ЗАЩИТЕН ИМПОРТ</p>
            <h2>OpenCart Orders CSV</h2>
          </div>
          <span className="admin-count">само администратор</span>
        </div>
        <p>
          Първо импортирайте клиентските профили. Поръчките се свързват по
          legacy customer ID, а при липса — само при еднозначно съвпадение на
          имейл. Останалите поръчки се пазят като несвързана историческа
          информация и не са видими в клиентски профил.
        </p>
        <div className="admin-brochure-upload-zone">
          <Archive size={30} />
          <div>
            <b>{fileName || "Изберете OpenCart order export"}</b>
            <p>
              Преди реалния импорт виждате само сборни проверки. Не се
              съхраняват адреси, телефони, payment details, IP или user-agent
              данни.
            </p>
          </div>
          <label className="admin-primary">
            <FileUp size={17} /> Избери CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={selectFile}
              disabled={!canReadLegacyOrders || preview.isPending || importer.isPending}
            />
          </label>
        </div>
        {preview.isPending && (
          <p className="admin-loading">
            <Loader2 size={18} className="animate-spin" /> Проверка на
            историческите записи…
          </p>
        )}
        {preview.data && (
          <div className="admin-customer-import-summary">
            <div>
              <span>Поръчки</span>
              <b>{preview.data.uniqueOrders}</b>
            </div>
            <div>
              <span>Продуктови редове</span>
              <b>{preview.data.orderLineCount}</b>
            </div>
            <div>
              <span>Клиентски ID</span>
              <b>{preview.data.uniqueSourceCustomerIds}</b>
            </div>
            <div>
              <span>Без клиентски ID</span>
              <b>{preview.data.rowsWithoutSourceCustomerId}</b>
            </div>
            <div>
              <span>Липсващ продукт</span>
              <b>{preview.data.rowsWithoutProductId}</b>
            </div>
            <div>
              <span>Невалидни редове</span>
              <b>{preview.data.malformedRows}</b>
            </div>
          </div>
        )}
        {preview.data && !isReady && (
          <p className="admin-form-error">
            Импортът е блокиран: CSV файлът има невалидни редове.
          </p>
        )}
        <div className="admin-form-actions">
          {canImportLegacyOrders && <button
            type="button"
            className="admin-primary"
            disabled={!isReady || importer.isPending}
            onClick={() => {
              if (csvData && canImportLegacyOrders) importer.mutate({ csvData });
            }}
          >
            {importer.isPending ? (
              <>
                <Loader2 size={17} className="animate-spin" /> Импортиране…
              </>
            ) : (
              <>
                <CheckCircle2 size={17} /> Импортирай проверената история
              </>
            )}
          </button>}
          {!canImportLegacyOrders && <ReadOnlyBadge text="Само преглед · импортът е недостъпен" />}
        </div>
      </section>
    </section>
  );
}

function AdminActivity({ permissions }: AdminPageProps) {
  const canReadActivity = can(permissions, "activity.read");
  const operations = trpc.admin.operations.useQuery(undefined, { enabled: canReadActivity });
  if (operations.isLoading) return <LoadingState />;
  if (!operations.data) return <ErrorState />;
  return (
    <section className="admin-workspace">
      <ShellHeading
        section="АКТИВНОСТ"
        title="Одитна история"
        text="Проверете материалните промени по каталог, наличности, промоции и заявки за потвърждение."
      />
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">ПОСЛЕДНИ ДЕЙСТВИЯ</p>
            <h2>Кой и какво е променил</h2>
          </div>
          <span className="admin-count">
            {operations.data.activities.length} записа
          </span>
        </div>
        {operations.data.activities.length ? (
          <div className="admin-activity-timeline">
            {operations.data.activities.map(activity => (
              <ActivityLine key={activity.id} activity={activity} detailed />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={History}
            title="Няма записани действия."
            text="След промяна на оперативен запис тук ще има одитна следа."
          />
        )}
      </section>
    </section>
  );
}

async function brochurePagesFromPdf(file: File) {
  const pdf = await getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  if (pdf.numPages < 1 || pdf.numPages > 16)
    throw new Error("Брошурата трябва да съдържа между 1 и 16 страници.");
  const pages: Array<{ dataUrl: string; fileName: string }> = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: Math.min(1.65, 1180 / baseViewport.width),
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не може да се подготви страница от PDF.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
    if (dataUrl.length > 4_500_000)
      throw new Error(
        `Страница ${pageNumber} е прекалено голяма след обработка.`
      );
    pages.push({
      dataUrl,
      fileName: `page-${String(pageNumber).padStart(2, "0")}.jpg`,
    });
  }
  return pages;
}

function AdminBrochures({ permissions }: AdminPageProps) {
  const utils = trpc.useUtils();
  const canReadBrochures = can(permissions, "brochures.read");
  const canWriteBrochures = can(permissions, "brochures.write");
  const brochures = trpc.admin.brochures.useQuery(undefined, { enabled: canReadBrochures });
  const [title, setTitle] = useState("Промо брошура");
  const [activateNow, setActivateNow] = useState(true);
  const [processing, setProcessing] = useState(false);
  const activate = trpc.admin.activateBrochure.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.brochures.invalidate(),
        utils.catalogue.brochure.invalidate(),
        utils.admin.operations.invalidate(),
      ]);
      toast("Брошурата е активна на началната страница.");
    },
  });
  const archive = trpc.admin.archiveBrochure.useMutation({
    onSuccess: async () => {
      await utils.admin.brochures.invalidate();
      toast("Брошурата е архивирана.");
    },
  });
  const upload = trpc.admin.uploadBrochure.useMutation({
    onSuccess: async () => {
      await utils.admin.brochures.invalidate();
      toast("Брошурата е качена като неактивна версия.");
    },
    onError: error =>
      toast(error.message || "Брошурата не можа да бъде качена."),
  });
  const uploadPage = trpc.admin.uploadBrochurePage.useMutation();
  const replace = trpc.admin.replaceBrochure.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.brochures.invalidate(),
        utils.catalogue.brochure.invalidate(),
        utils.admin.operations.invalidate(),
      ]);
      toast("Новата брошура е активна на началната страница.");
    },
    onError: error =>
      toast(error.message || "Брошурата не можа да бъде заменена."),
  });
  async function handlePdfUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !canWriteBrochures) return;
    event.target.value = "";
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf || file.size > 20 * 1024 * 1024) {
      toast("Изберете PDF файл до 20 MB.");
      return;
    }
    try {
      setProcessing(true);
      const pages = await brochurePagesFromPdf(file);
      const pageUrls: string[] = [];
      for (const page of pages) {
        const stored = await uploadPage.mutateAsync(page);
        pageUrls.push(stored.url);
      }
      const payload = { title: title.trim() || "Промо брошура", pageUrls };
      if (activateNow) replace.mutate(payload);
      else
        toast(
          "Всички страници са качени. Активирайте версията след създаване на нов запис."
        );
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "PDF файлът не може да бъде обработен."
      );
    } finally {
      setProcessing(false);
    }
  }
  const active = (brochures.data ?? []).find(brochure => brochure.isActive);
  return (
    <section className="admin-workspace">
      <ShellHeading
        section="БРОШУРИ"
        title="Промоционални брошури"
        text="Качете PDF файл, страниците му се подготвят като slideshow и избраната версия се показва на началната страница."
        action={!canWriteBrochures ? <ReadOnlyBadge /> : undefined}
      />
      <section className="admin-brochure-command">
        <div>
          <p className="admin-kicker">АКТИВНА ВЕРСИЯ</p>
          <h2>{active?.title ?? "Няма активна брошура"}</h2>
          <p>
            {active
              ? `${active.pageCount} страници · последна промяна ${active.updatedAt ? formatDate(active.updatedAt) : "—"}`
              : "Качете и активирайте първата брошура."}
          </p>
        </div>
        {active?.pageUrls[0] && <img src={active.pageUrls[0]} alt="" />}
      </section>
      <section className="admin-edit-panel admin-brochure-upload">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">НОВА ВЕРСИЯ</p>
            <h2>Качване на PDF брошура</h2>
          </div>
          <span className="admin-count">до 16 страници · до 20 MB</span>
        </div>
        <div className="admin-form-grid">
          <label>
            Заглавие на брошурата
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              disabled={!canWriteBrochures}
              placeholder="напр. Промо брошура · септември 2026"
            />
          </label>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={activateNow}
              disabled={!canWriteBrochures}
              onChange={event => setActivateNow(event.target.checked)}
            />{" "}
            Активирай автоматично след качване
          </label>
        </div>
        <div className="admin-brochure-upload-zone">
          <FileUp size={30} />
          <div>
            <b>
              {processing ||
              uploadPage.isPending ||
              upload.isPending ||
              replace.isPending
                ? "Подготовка и качване..."
                : "Изберете PDF брошура"}
            </b>
            <p>
              PDF страниците се превръщат в оптимизирани JPEG изображения и се
              качват една по една за надеждно homepage slideshow обновяване.
            </p>
          </div>
          <label className="admin-primary">
            <FileUp size={17} /> Избери PDF
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={handlePdfUpload}
              disabled={
                !canWriteBrochures ||
                processing ||
                uploadPage.isPending ||
                upload.isPending ||
                replace.isPending ||
                activate.isPending
              }
            />
          </label>
        </div>
        {(upload.error || replace.error || uploadPage.error) && (
          <p className="admin-form-error">
            {upload.error?.message ??
              replace.error?.message ??
              uploadPage.error?.message}
          </p>
        )}
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">ВЕРСИИ</p>
            <h2>История на брошурите</h2>
          </div>
          <span className="admin-count">
            {brochures.data?.length ?? 0} версии
          </span>
        </div>
        {brochures.isLoading ? (
          <LoadingState />
        ) : (
          <div className="admin-brochure-list">
            {(brochures.data ?? []).map((brochure: AdminBrochure) => (
              <article
                key={brochure.id}
                className={brochure.isActive ? "is-active" : ""}
              >
                <img src={brochure.pageUrls[0]} alt="" />
                <div>
                  <div className="admin-brochure-record-head">
                    <span
                      className={`admin-status ${brochure.isActive ? "availability-in_stock" : brochure.isArchived ? "availability-out_of_stock" : "availability-on_request"}`}
                    >
                      {brochure.isActive
                        ? "Активна"
                        : brochure.isArchived
                          ? "Архив"
                          : "Неактивна"}
                    </span>
                    <small>{brochure.pageCount} страници</small>
                  </div>
                  <h3>{brochure.title}</h3>
                  <p>
                    {brochure.updatedAt
                      ? `Променена ${formatDate(brochure.updatedAt)}`
                      : "Нова версия"}
                  </p>
                  <div className="admin-brochure-actions">
                    {brochure.sourcePdfUrl && (
                      <a
                        href={brochure.sourcePdfUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download size={15} /> PDF
                      </a>
                    )}
                    {canWriteBrochures && !brochure.isActive && !brochure.isArchived && (
                      <button
                        type="button"
                        className="admin-primary"
                        disabled={activate.isPending}
                        onClick={() => {
                          if (canWriteBrochures) activate.mutate({ id: brochure.id });
                        }}
                      >
                        <FileCheck2 size={15} /> Активирай
                      </button>
                    )}
                    {canWriteBrochures && !brochure.isActive && !brochure.isArchived && (
                      <button
                        type="button"
                        className="admin-text-action"
                        disabled={archive.isPending}
                        onClick={() => {
                          if (canWriteBrochures) archive.mutate({ id: brochure.id });
                        }}
                      >
                        <Archive size={15} /> Архивирай
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function ActivityLine({
  activity,
  detailed = false,
}: {
  activity: {
    id: number;
    action: string;
    entityType: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
    adminName: string;
  };
  detailed?: boolean;
}) {
  const label: Record<string, string> = {
    "product.created": "добави артикул",
    "product.updated": "обнови артикул",
    "category.created": "добави категория",
    "category.updated": "обнови категория",
    "inventory.adjusted": "коригира наличност",
    "promotion.updated": "обнови промоция",
    "order.updated": "обнови заявка",
    "product_image.uploaded": "качи изображение",
    "brochure.uploaded": "качи брошура",
    "brochure.activated": "активира брошура",
    "brochure.archived": "архивира брошура",
    "customer_profiles.imported": "импортира клиентски профили",
    "customer_orders.imported": "импортира исторически поръчки",
    "role.created": "създаде роля",
    "role.updated": "обнови роля",
    "role.deleted": "изтри роля",
    "customer.role_assigned": "назначи роля на клиент",
  };
  return (
    <div className="admin-activity-row">
      <span className="admin-activity-dot" />
      <div>
        <b>
          {activity.adminName} {label[activity.action] ?? activity.action}
        </b>
        <p>
          {String(
            activity.metadata.name ??
              activity.metadata.title ??
              activity.metadata.slug ??
              activity.entityType
          )}
          {activity.metadata.delta
            ? ` · промяна: ${String(activity.metadata.delta)}`
            : ""}
        </p>
      </div>
      {detailed && <small>{formatDate(activity.createdAt)}</small>}
    </div>
  );
}
function OrderCard({
  order,
}: {
  order: AdminOrder;
}) {
  return (
    <Link href={`/admin/requests/${order.id}`} className="admin-order-card admin-order-card-link">
      <div className="admin-order-product">
        <img src={order.productImageUrl} alt="" />
        <div>
          <p className="admin-kicker">{order.requestNumber}</p>
          <h3>{order.productName}</h3>
          <span>
            Количество: {order.quantity}
            {order.totalEur
              ? ` · ${Number(order.totalEur).toFixed(2)}€`
              : " · По запитване"}
          </span>
          {order.items && order.items.length > 1 && (
            <ul className="admin-order-items">
              {order.items.map(item => (
                <li key={item.id}>
                  {item.productName} × {item.quantity}
                  {item.totalEur
                    ? ` · ${Number(item.totalEur).toFixed(2)}€`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="admin-order-contact">
        <b>{order.fullName}</b>
        <span>{order.email}</span>
        <span>{order.phone}</span>
        <span>
          {order.address}, {order.region ? `${order.region}, ` : ""}
          {order.postcode} {order.city}
        </span>
        <small>{formatDate(order.createdAt)}</small>
      </div>
      <div className="admin-order-actions">
        <span className={`admin-order-status admin-order-status-${order.status}`}>{statusLabels[order.status]}</span>
        <b>Отвори заявката →</b>
      </div>
    </Link>
  );
}
function ContactEnquiryCard({
  enquiry,
  busy,
  canWrite,
  onSave,
}: {
  enquiry: AdminContactEnquiry;
  busy: boolean;
  canWrite: boolean;
  onSave: (status: ContactEnquiryStatus, note: string | null) => void;
}) {
  const [status, setStatus] = useState<ContactEnquiryStatus>(enquiry.status);
  const [note, setNote] = useState(enquiry.adminNote ?? "");
  return (
    <article className="admin-order-card">
      <div className="admin-order-product">
        <div>
          <p className="admin-kicker">{enquiry.referenceNumber}</p>
          <h3>{enquiry.subject}</h3>
          <span>{enquiry.message}</span>
        </div>
      </div>
      <div className="admin-order-contact">
        <b>{enquiry.fullName}</b>
        <a href={`mailto:${enquiry.email}`}>{enquiry.email}</a>
        {enquiry.phone && (
          <a href={`tel:${enquiry.phone.replace(/[^0-9+]/g, "")}`}>
            {enquiry.phone}
          </a>
        )}
        <small>{formatDate(enquiry.createdAt)}</small>
      </div>
      <div className="admin-order-actions">
        <fieldset disabled={!canWrite}>
        <label>
          Статус
          <select
            value={status}
            onChange={event =>
              setStatus(event.target.value as ContactEnquiryStatus)
            }
          >
            {(
              Object.keys(contactEnquiryStatusLabels) as ContactEnquiryStatus[]
            ).map(item => (
              <option key={item} value={item}>
                {contactEnquiryStatusLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Вътрешна бележка
          <textarea
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="видимо само за администратори"
          />
        </label>
        {canWrite ? <button
          type="button"
          className="admin-primary"
          disabled={busy}
          onClick={() => onSave(status, note.trim() || null)}
        >
          <Save size={16} /> Запази
        </button> : <ReadOnlyBadge text="Само преглед · обработката е недостъпна" />}
        </fieldset>
      </div>
    </article>
  );
}
function LoadingState() {
  return (
    <div className="admin-loading">
      <Loader2 size={22} className="animate-spin" /> Зареждане на данни…
    </div>
  );
}
function ErrorState() {
  return (
    <div className="admin-error">
      Данните не могат да бъдат заредени в момента. Обновете страницата или
      проверете достъпа си.
    </div>
  );
}
function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Archive;
  title: string;
  text: string;
}) {
  return (
    <div className="admin-empty">
      <Icon size={25} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function emptyProductForm(categoryId: number): ProductForm {
  return {
    categoryId,
    slug: "",
    slugMode: "automatic",
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
    seoRobots: "index,follow",
    sku: "",
    brand: "",
    name: "",
    description: "",
    imageUrl: "",
    galleryText: "",
    imageAlt: "",
    priceEur: "",
    oldPriceEur: "",
    discountLabel: "",
    availability: "on_request",
    stockQuantity: "0",
    technicalRows: [{ label: "", value: "" }],
    isActive: true,
  };
}
function emptyCategoryForm(): CategoryForm {
  return {
    slug: "",
    name: "",
    description: "",
    imageUrl: "",
    icon: "drill",
    subcategoriesText: "",
    sortOrder: "0",
    isActive: true,
  };
}
function AdminWorkspace({
  staff,
  isLoading,
  error,
}: {
  staff: StaffPermissionState | null | undefined;
  isLoading: boolean;
  error: boolean;
}) {
  const [location, setLocation] = useLocation();
  const permissions = staff?.permissions ?? [];
  const redirectPath =
    location === "/admin" && !can(permissions, "dashboard.read")
      ? firstAdminPath(permissions)
      : null;

  useEffect(() => {
    if (redirectPath && redirectPath !== location) setLocation(redirectPath);
  }, [location, redirectPath, setLocation]);

  if (isLoading) return <LoadingState />;
  if (error || !staff || !staff.canAccess) return <AccessDeniedState />;
  if (redirectPath) {
    return <AccessDeniedState text="Пренасочване към първата разрешена секция…" />;
  }
  if (!canVisitAdminSection(permissions, location)) {
    return <AccessDeniedState />;
  }

  if (location === "/admin") return <AdminOverview permissions={permissions} />;
  if (location === "/admin/products") return <AdminProducts permissions={permissions} />;
  if (location === "/admin/inventory") return <AdminInventory permissions={permissions} />;
  if (location === "/admin/promotions") return <AdminPromotions permissions={permissions} />;
  if (location === "/admin/brochures") return <AdminBrochures permissions={permissions} />;
  if (location === "/admin/categories") return <AdminCategories permissions={permissions} />;
  if (location === "/admin/orders") return <AdminOrders permissions={permissions} />;
  if (location === "/admin/enquiries") return <AdminContactEnquiries permissions={permissions} />;
  if (location === "/admin/customers") return <AdminCustomers permissions={permissions} />;
  if (location === "/admin/legacy-orders") return <AdminLegacyOrders permissions={permissions} />;
  if (location === "/admin/activity") return <AdminActivity permissions={permissions} />;
  if (location === "/admin/users-roles") return <AdminUsersRoles />;
  return <AccessDeniedState text="Непознат административен маршрут." />;
}
export default function Admin() {
  const staffQuery = trpc.staff.me.useQuery();
  return (
    <DashboardLayout>
      <AdminWorkspace
        staff={staffQuery.data}
        isLoading={staffQuery.isLoading}
        error={Boolean(staffQuery.error)}
      />
    </DashboardLayout>
  );
}
