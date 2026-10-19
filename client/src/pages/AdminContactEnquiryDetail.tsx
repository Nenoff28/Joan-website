import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
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

type ContactEnquiryStatus = "new" | "contacted" | "closed";
type HistoryEntry = {
  id: number;
  status: ContactEnquiryStatus;
  comment: string | null;
  authorId: number | null;
  authorName: string;
  createdAt: Date;
};
type ContactEnquiryDetail = {
  id: number;
  referenceNumber: string;
  fullName: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: ContactEnquiryStatus;
  isDeleted: boolean;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  history: HistoryEntry[];
};

const statusLabels: Record<ContactEnquiryStatus, string> = {
  new: "Ново",
  contacted: "Свързване",
  closed: "Приключено",
};

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Sofia",
  }).format(new Date(value));

function ContactEnquiryDetailContent() {
  const [, params] = useRoute("/admin/enquiries/:id");
  const [, setLocation] = useLocation();
  const enquiryId = Number(params?.id);
  const utils = trpc.useUtils();
  const staff = trpc.staff.me.useQuery();
  const canRead = Boolean(staff.data?.permissions.includes("enquiries.read"));
  const canWrite = Boolean(staff.data?.permissions.includes("enquiries.write"));
  const detail = trpc.admin.contactEnquiryDetail.useQuery(
    { id: enquiryId },
    { enabled: Number.isInteger(enquiryId) && enquiryId > 0 && canRead },
  );
  const update = trpc.admin.updateContactEnquiry.useMutation({
    onSuccess: async () => {
      setComment("");
      await Promise.all([
        utils.admin.contactEnquiryDetail.invalidate({ id: enquiryId }),
        utils.admin.contactEnquiries.invalidate(),
        utils.admin.operations.invalidate(),
      ]);
      toast.success("Добавен е нов запис в историята на запитването.");
    },
    onError: error => toast.error(error.message || "Промяната не беше записана."),
  });
  const remove = trpc.admin.deleteContactEnquiry.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.admin.contactEnquiries.invalidate(), utils.admin.operations.invalidate()]);
      toast.success("Запитването е изтрито от списъка. Историята и коментарите са запазени.");
      setLocation("/admin/enquiries");
    },
    onError: error => toast.error(error.message || "Запитването не беше изтрито."),
  });
  const enquiry = detail.data as ContactEnquiryDetail | undefined;
  const [status, setStatus] = useState<ContactEnquiryStatus>("new");
  const [comment, setComment] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (enquiry) setStatus(enquiry.status);
  }, [enquiry]);

  if (staff.isLoading || (canRead && detail.isLoading)) {
    return (
      <section className="ord-detail-shell" aria-live="polite">
        <p className="ord-detail-feedback"><Loader2 size={18} className="animate-spin" /> Зареждане на запитването…</p>
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="ord-detail-shell">
        <div className="ord-detail-denied" role="alert">
          <ShieldAlert size={24} />
          <div><b>Достъпът е ограничен.</b><p>Нямате право да преглеждате контактни запитвания.</p></div>
          <Link href="/admin/enquiries" className="ord-detail-back-link"><ArrowLeft size={16} /> Към запитванията</Link>
        </div>
      </section>
    );
  }

  if (!Number.isInteger(enquiryId) || enquiryId <= 0 || detail.error || !enquiry) {
    return (
      <section className="ord-detail-shell">
        <div className="ord-detail-denied" role="alert">
          <FileText size={24} />
          <div><b>Запитването не е намерено.</b><p>Възможно е да е изтрито или адресът да не е валиден.</p></div>
          <Link href="/admin/enquiries" className="ord-detail-back-link"><ArrowLeft size={16} /> Към списъка</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="ord-detail-shell">
      <div className="ord-detail-topline">
        <Link href="/admin/enquiries" className="ord-detail-back-link"><ArrowLeft size={16} /> Всички запитвания</Link>
        <span>Последно обновено: {formatDate(enquiry.updatedAt)}</span>
      </div>
      <header className="ord-detail-heading">
        <div>
          <p>КОНТАКТНО ЗАПИТВАНЕ</p>
          <h1>{enquiry.referenceNumber}</h1>
          <span>Получено на {formatDate(enquiry.createdAt)}</span>
        </div>
        <div className="ord-detail-heading-actions">
          <div className={`ord-status ord-status-${enquiry.status}`}><CheckCircle2 size={17} /> {statusLabels[enquiry.status]}</div>
          {enquiry.isDeleted ? <span className="ord-deleted-badge">Изтрито</span> : canWrite && <Button type="button" className="ord-delete-button" disabled={remove.isPending} onClick={() => setDeleteOpen(true)}><Trash2 size={16} /> Изтрий</Button>}
        </div>
      </header>
      <div className="ord-detail-layout">
        <div className="ord-detail-main">
          <section className="ord-detail-card">
            <div className="ord-detail-card-head"><div><p>СЪОБЩЕНИЕ</p><h2>{enquiry.subject}</h2></div><span>Пълният текст на запитването</span></div>
            <div className="ord-enquiry-message">{enquiry.message}</div>
          </section>
          <section className="ord-detail-card ord-history-card">
            <div className="ord-detail-card-head"><div><p>ПРОСЛЕДИМОСТ</p><h2>История на статусите и коментарите</h2></div><span>Най-новите са най-горе</span></div>
            <p className="ord-history-note">Всеки запис е постоянен. Старите коментари и автори остават видими за всички оператори и администратори.</p>
            <ol className="ord-history-list">
              {enquiry.history.map(entry => (
                <li key={entry.id} className="ord-history-entry">
                  <div className={`ord-history-dot ord-history-dot-${entry.status}`} aria-hidden="true" />
                  <div className="ord-history-content">
                    <div className="ord-history-title"><span className={`ord-status ord-status-${entry.status}`}>{statusLabels[entry.status]}</span><time dateTime={new Date(entry.createdAt).toISOString()}>{formatDate(entry.createdAt)}</time></div>
                    <div className="ord-history-author"><UserRound size={14} /> {entry.authorName}</div>
                    {entry.comment ? <p className="ord-history-comment">{entry.comment}</p> : <p className="ord-history-empty">Няма добавен коментар към този статус.</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="ord-detail-side">
          <section className="ord-detail-card ord-customer-card">
            <p>КОНТАКТ</p><h2>{enquiry.fullName}</h2>
            <a href={`mailto:${enquiry.email}`}><Mail size={16} /> {enquiry.email}</a>
            {enquiry.phone && <a href={`tel:${enquiry.phone.replace(/[^0-9+]/g, "")}`}><Phone size={16} /> {enquiry.phone}</a>}
          </section>
          <section className="ord-detail-card ord-status-form-card">
            <div><p>НОВ ЗАПИС В ИСТОРИЯТА</p><h2>Обработка на запитването</h2><span>Авторът се добавя автоматично от активния профил.</span></div>
            <fieldset disabled={!canWrite || update.isPending || enquiry.isDeleted}>
              <label>Нов статус<select value={status} onChange={event => setStatus(event.target.value as ContactEnquiryStatus)}>{(Object.keys(statusLabels) as ContactEnquiryStatus[]).map(item => <option key={item} value={item}>{statusLabels[item]}</option>)}</select></label>
              <label>Коментар към този статус<textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={4000} placeholder="Например: Свързахме се с клиента и уточнихме детайлите." /></label>
              <small>{comment.length}/4000 знака</small>
              {enquiry.isDeleted ? <p className="ord-read-only"><FileText size={15} /> Изтритото запитване е само за преглед.</p> : canWrite ? <Button type="button" className="ord-save-status" onClick={() => update.mutate({ id: enquiry.id, status, adminNote: comment.trim() || null })}>{update.isPending ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Добави в историята</Button> : <p className="ord-read-only"><FileText size={15} /> Само преглед — нямате право да променяте статуса.</p>}
            </fieldset>
          </section>
        </aside>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={open => { if (!open && !remove.isPending) setDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Изтриване на запитването?</AlertDialogTitle><AlertDialogDescription>Запитването ще бъде скрито от стандартния списък. Историята на статусите, коментарите и audit записът ще бъдат запазени. Действието не може да се отмени от този екран.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={remove.isPending}>Отказ</AlertDialogCancel><AlertDialogAction disabled={remove.isPending} onClick={event => { event.preventDefault(); if (!remove.isPending) remove.mutate({ id: enquiry.id }); }}>{remove.isPending ? "Изтриване…" : "Да, изтрий запитването"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default function AdminContactEnquiryDetail() {
  return <DashboardLayout><ContactEnquiryDetailContent /></DashboardLayout>;
}
