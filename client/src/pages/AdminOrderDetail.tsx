import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Save,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";
import "./adminOrderDetail.css";

type OrderStatus = "new" | "contacted" | "confirmed" | "closed" | "cancelled";

type RequestItem = {
  id: number;
  productId: number | null;
  productName: string;
  productSku: string | null;
  productImageUrl: string;
  quantity: number;
  priceEur: string | null;
  totalEur: string | null;
  parameters: string[];
};

type StatusHistoryEntry = {
  id: number;
  status: OrderStatus;
  comment: string | null;
  authorId: number | null;
  authorName: string;
  createdAt: Date;
};

type OrderDetail = {
  id: number;
  requestNumber: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  region: string | null;
  city: string;
  postcode: string;
  status: OrderStatus;
  isDeleted: boolean;
  quantity: number;
  totalEur: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: RequestItem[];
  history: StatusHistoryEntry[];
};

const statusLabels: Record<OrderStatus, string> = {
  new: "Нова",
  contacted: "Свързване",
  confirmed: "Потвърдена",
  closed: "Приключена",
  cancelled: "Отказана",
};

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Sofia",
  }).format(new Date(value));

const money = (value: string | null) =>
  value === null
    ? "По запитване"
    : new Intl.NumberFormat("bg-BG", {
        style: "currency",
        currency: "EUR",
      }).format(Number(value));

function RequestDetailContent() {
  const [, params] = useRoute("/admin/requests/:id");
  const [, setLocation] = useLocation();
  const requestId = Number(params?.id);
  const utils = trpc.useUtils();
  const staff = trpc.staff.me.useQuery();
  const canRead = Boolean(staff.data?.permissions.includes("orders.read"));
  const canWrite = Boolean(staff.data?.permissions.includes("orders.write"));
  const detail = trpc.admin.orderDetail.useQuery(
    { id: requestId },
    { enabled: Number.isInteger(requestId) && requestId > 0 && canRead }
  );
  const update = trpc.admin.updateOrder.useMutation({
    onSuccess: async () => {
      setComment("");
      await Promise.all([
        utils.admin.orderDetail.invalidate({ id: requestId }),
        utils.admin.orders.invalidate(),
        utils.admin.summary.invalidate(),
        utils.admin.operations.invalidate(),
      ]);
      toast.success("Добавен е нов запис в историята на заявката.");
    },
    onError: error =>
      toast.error(error.message || "Промяната по заявката не беше записана."),
  });
  const remove = trpc.admin.deleteOrder.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.admin.orders.invalidate(), utils.admin.summary.invalidate(), utils.admin.operations.invalidate()]);
      toast.success("Заявката е изтрита от списъка. Историята и продуктите са запазени.");
      setLocation("/admin/orders");
    },
    onError: error => toast.error(error.message || "Заявката не беше изтрита."),
  });
  const order = detail.data as OrderDetail | undefined;
  const [status, setStatus] = useState<OrderStatus>("new");
  const [comment, setComment] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (order) setStatus(order.status);
  }, [order]);

  if (staff.isLoading || (canRead && detail.isLoading)) {
    return (
      <section className="ord-detail-shell" aria-live="polite">
        <p className="ord-detail-feedback">
          <Loader2 size={18} className="animate-spin" /> Зареждане на заявката…
        </p>
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="ord-detail-shell">
        <div className="ord-detail-denied" role="alert">
          <ShieldAlert size={24} />
          <div>
            <b>Достъпът е ограничен.</b>
            <p>Нямате право да преглеждате заявки за доставка.</p>
          </div>
          <Link href="/admin/orders" className="ord-detail-back-link">
            <ArrowLeft size={16} /> Към заявките
          </Link>
        </div>
      </section>
    );
  }

  if (
    !Number.isInteger(requestId) ||
    requestId <= 0 ||
    detail.error ||
    !order
  ) {
    return (
      <section className="ord-detail-shell">
        <div className="ord-detail-denied" role="alert">
          <ClipboardList size={24} />
          <div>
            <b>Заявката не е намерена.</b>
            <p>Възможно е да е изтрита или адресът да не е валиден.</p>
          </div>
          <Link href="/admin/orders" className="ord-detail-back-link">
            <ArrowLeft size={16} /> Към списъка
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="ord-detail-shell">
      <div className="ord-detail-topline">
        <Link href="/admin/orders" className="ord-detail-back-link">
          <ArrowLeft size={16} /> Всички заявки
        </Link>
        <span>Последно обновена: {formatDate(order.updatedAt)}</span>
      </div>

      <header className="ord-detail-heading">
        <div>
          <p>ЗАЯВКА ЗА ДОСТАВКА</p>
          <h1>{order.requestNumber}</h1>
          <span>Получена на {formatDate(order.createdAt)}</span>
        </div>
        <div className="ord-detail-heading-actions">
          <div className={`ord-status ord-status-${order.status}`}><CheckCircle2 size={17} /> {statusLabels[order.status]}</div>
          {order.isDeleted ? <span className="ord-deleted-badge">Изтрита</span> : canWrite && <Button type="button" className="ord-delete-button" disabled={remove.isPending} onClick={() => setDeleteOpen(true)}><Trash2 size={16} /> Изтрий</Button>}
        </div>
      </header>

      <div className="ord-detail-layout">
        <div className="ord-detail-main">
          <section className="ord-detail-card">
            <div className="ord-detail-card-head">
              <div>
                <p>ПРОДУКТИ</p>
                <h2>Артикули в заявката</h2>
              </div>
              <span>
                {order.items.length}{" "}
                {order.items.length === 1 ? "артикул" : "артикула"}
              </span>
            </div>
            <div className="ord-item-list">
              {order.items.map(item => (
                <article key={item.id} className="ord-item">
                  <div className="ord-item-image">
                    <img
                      src={item.productImageUrl}
                      alt={item.productName}
                      loading="lazy"
                    />
                  </div>
                  <div className="ord-item-copy">
                    <h3>{item.productName}</h3>
                    <div className="ord-item-meta">
                      {item.productSku && <span>Код: {item.productSku}</span>}
                      <span>Количество: {item.quantity}</span>
                      <span>Ед. цена: {money(item.priceEur)}</span>
                      <strong>Общо: {money(item.totalEur)}</strong>
                    </div>
                    {item.parameters.length > 0 && (
                      <details className="ord-item-parameters">
                        <summary>
                          Технически данни и параметри ({item.parameters.length}
                          )
                        </summary>
                        <ul>
                          {item.parameters.map((parameter, index) => (
                            <li key={`${item.id}-${index}`}>{parameter}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <div className="ord-total-row">
              <span>Обща стойност на заявката</span>
              <b>{money(order.totalEur)}</b>
            </div>
          </section>

          <section className="ord-detail-card ord-history-card">
            <div className="ord-detail-card-head">
              <div>
                <p>ПРОСЛЕДИМОСТ</p>
                <h2>История на статусите и коментарите</h2>
              </div>
              <span>Най-новите са най-горе</span>
            </div>
            <p className="ord-history-note">
              Всеки запис е постоянен. Коментарите и авторите остават видими за
              всички оператори и администратори.
            </p>
            <ol className="ord-history-list">
              {order.history.map(entry => (
                <li key={entry.id} className="ord-history-entry">
                  <div
                    className={`ord-history-dot ord-history-dot-${entry.status}`}
                    aria-hidden="true"
                  />
                  <div className="ord-history-content">
                    <div className="ord-history-title">
                      <span className={`ord-status ord-status-${entry.status}`}>
                        {statusLabels[entry.status]}
                      </span>
                      <time dateTime={new Date(entry.createdAt).toISOString()}>
                        {formatDate(entry.createdAt)}
                      </time>
                    </div>
                    <div className="ord-history-author">
                      <UserRound size={14} /> {entry.authorName}
                    </div>
                    {entry.comment ? (
                      <p className="ord-history-comment">{entry.comment}</p>
                    ) : (
                      <p className="ord-history-empty">
                        Няма добавен коментар към този статус.
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="ord-detail-side">
          <section className="ord-detail-card ord-customer-card">
            <p>КЛИЕНТ И ДОСТАВКА</p>
            <h2>{order.fullName}</h2>
            <a href={`mailto:${order.email}`}>
              <Mail size={16} /> {order.email}
            </a>
            <a href={`tel:${order.phone.replace(/[^0-9+]/g, "")}`}>
              <Phone size={16} /> {order.phone}
            </a>
            <div className="ord-address">
              <MapPin size={16} />
              <span>
                {order.address}
                <br />
                {order.region ? `${order.region}, ` : ""}
                {order.postcode} {order.city}
              </span>
            </div>
          </section>

          <section className="ord-detail-card ord-status-form-card">
            <div>
              <p>НОВ ЗАПИС В ИСТОРИЯТА</p>
              <h2>Промяна на статуса</h2>
              <span>Авторът се добавя автоматично от активния профил.</span>
            </div>
            <fieldset disabled={!canWrite || update.isPending || order.isDeleted}>
              <label>
                Нов статус
                <select
                  value={status}
                  onChange={event =>
                    setStatus(event.target.value as OrderStatus)
                  }
                >
                  {(Object.keys(statusLabels) as OrderStatus[]).map(item => (
                    <option key={item} value={item}>
                      {statusLabels[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Коментар към този статус
                <textarea
                  value={comment}
                  onChange={event => setComment(event.target.value)}
                  maxLength={4000}
                  placeholder="Например: Свързахме се с клиента и уточнихме часа за доставка."
                />
              </label>
              <small>{comment.length}/4000 знака</small>
              {order.isDeleted ? <p className="ord-read-only"><FileText size={15} /> Изтритата заявка е само за преглед.</p> : canWrite ? (
                <Button
                  type="button"
                  className="ord-save-status"
                  onClick={() =>
                    update.mutate({
                      id: order.id,
                      status,
                      adminNote: comment.trim() || null,
                    })
                  }
                >
                  {update.isPending ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Save size={17} />
                  )}{" "}
                  Добави в историята
                </Button>
              ) : (
                <p className="ord-read-only">
                  <FileText size={15} /> Само преглед — нямате право да
                  променяте статус.
                </p>
              )}
            </fieldset>
          </section>
        </aside>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={open => { if (!open && !remove.isPending) setDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Изтриване на заявката?</AlertDialogTitle><AlertDialogDescription>Заявката ще бъде скрита от стандартния списък. Историята на статусите, коментарите, продуктите и audit записът ще бъдат запазени. Действието не може да се отмени от този екран.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={remove.isPending}>Отказ</AlertDialogCancel><AlertDialogAction disabled={remove.isPending} onClick={event => { event.preventDefault(); if (!remove.isPending) remove.mutate({ id: order.id }); }}>{remove.isPending ? "Изтриване…" : "Да, изтрий заявката"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default function AdminOrderDetail() {
  return (
    <DashboardLayout>
      <RequestDetailContent />
    </DashboardLayout>
  );
}
