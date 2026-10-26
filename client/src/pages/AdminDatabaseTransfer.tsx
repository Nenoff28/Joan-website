import { trpc } from "@/lib/trpc";
import { Database, Download, FileCheck2, FileUp, Loader2, ShieldAlert } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { toast } from "sonner";

type ImportPreview = {
  checksum: string;
  bytes: number;
  statements: number;
  insertStatements: number;
  tables: string[];
  requiresReplace: boolean;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AdminDatabaseTransfer() {
  const [sql, setSql] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const exportMutation = trpc.admin.databaseExport.useMutation({
    onError: error => toast.error(`Exportът не беше създаден: ${error.message}`),
  });
  const previewMutation = trpc.admin.databaseImportPreview.useMutation({
    onSuccess: result => {
      setPreview(result);
      toast.success("SQL файлът е проверен. Прегледайте какво ще бъде заменено.");
    },
    onError: error => {
      setPreview(null);
      toast.error(`Файлът не може да бъде импортиран: ${error.message}`);
    },
  });
  const importMutation = trpc.admin.databaseImport.useMutation({
    onSuccess: result => {
      toast.success(`Импортът завърши успешно: ${result.executedStatements} SQL команди.`);
      setSql("");
      setFileName("");
      setPreview(null);
    },
    onError: error => toast.error(`Импортът беше прекъснат: ${error.message}`),
  });

  const downloadExport = async () => {
    try {
      const result = await exportMutation.mutateAsync();
      const blob = new Blob([result.content], { type: "application/sql;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exportът е свален: ${formatBytes(result.bytes)}, ${result.tableCount} таблици, ${result.rowCount} реда.`);
    } catch {
      // onError from the mutation shows the server message.
    }
  };

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.sql$/i.test(file.name)) {
      toast.error("Изберете SQL файл с разширение .sql.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("SQL файлът не може да е по-голям от 50 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      setSql(value);
      setFileName(file.name);
      setPreview(null);
      previewMutation.mutate({ sql: value });
    };
    reader.onerror = () => toast.error("SQL файлът не може да бъде прочетен.");
    reader.readAsText(file);
  };

  const runImport = () => {
    if (!preview || !sql) return;
    const confirmed = window.confirm(
      `Потвърждавате ли заместването на текущата база данни?\n\n` +
        `Ще бъдат изпълнени ${preview.statements} SQL команди за ${preview.tables.length} таблици. ` +
        `Това действие е разрушително и не може да бъде отменено от сайта.`
    );
    if (!confirmed) return;
    importMutation.mutate({ sql, checksum: preview.checksum, confirmReplace: true });
  };

  return (
    <section className="admin-workspace">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow"><Database size={14} /> БАЗА ДАННИ · САМО АДМИНИСТРАТОР</p>
          <h1>Експорт и импорт на база данни</h1>
          <p className="admin-panel-caption">Създайте преносим SQL backup за стандартен MySQL хостинг или възстановете Joan backup след preview.</p>
        </div>
      </div>

      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div><h2>Експорт към MySQL</h2><p>Генерира структурата и данните на всички текущи таблици в един .sql файл.</p></div>
            <Download size={22} className="text-[#d71920]" />
          </div>
          <div className="admin-command-strip">
            <div><span>01</span><p><b>Свали пълен backup</b> Файлът е съвместим с phpMyAdmin и стандартен MySQL import.</p></div>
          </div>
          <button type="button" className="admin-primary" onClick={downloadExport} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exportMutation.isPending ? "Подготвям SQL…" : "Експортирай базата"}
          </button>
          <p className="mt-3 text-xs text-muted-foreground">Сваленият файл съдържа и служебни записи. Пазете го като чувствителен backup.</p>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div><h2>Импорт от SQL</h2><p>Качете Joan .sql export. Първо се прави проверка, без да се променя базата.</p></div>
            <FileUp size={22} className="text-[#d71920]" />
          </div>
          <label className="admin-primary inline-flex cursor-pointer">
            <FileUp size={16} /> Избери SQL файл
            <input type="file" accept=".sql,application/sql,text/plain" className="sr-only" onChange={selectFile} />
          </label>
          {fileName ? <p className="mt-3 text-sm"><b>Избран файл:</b> {fileName}</p> : null}
          {preview ? (
            <div className="mt-4 rounded-xl border border-[#f0d4d4] bg-[#fff8f8] p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-[#8f1419]"><FileCheck2 size={17} /> Файлът е валиден и готов за preview/import</div>
              <p className="mt-2">Размер: <b>{formatBytes(preview.bytes)}</b> · Команди: <b>{preview.statements}</b> · INSERT команди: <b>{preview.insertStatements}</b></p>
              <p className="mt-1">Таблици: <b>{preview.tables.length}</b></p>
              <details className="mt-2"><summary className="cursor-pointer">Покажи таблиците</summary><p className="mt-1 break-words text-xs">{preview.tables.join(", ")}</p></details>
              <button type="button" className="admin-danger mt-4" onClick={runImport} disabled={importMutation.isPending}>
                {importMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                {importMutation.isPending ? "Импортиране…" : "Потвърди и замести базата"}
              </button>
              <p className="mt-2 text-xs text-[#8f1419]">Това изтрива и създава наново таблиците от backup-а. Направете export на текущата база преди потвърждение.</p>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
