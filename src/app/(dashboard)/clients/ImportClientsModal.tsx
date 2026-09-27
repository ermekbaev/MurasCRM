"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Upload, FileSpreadsheet, Check, Loader2, ArrowRight } from "lucide-react";

/** Поля клиента, которые умеем импортировать, и их человеческие названия. */
const FIELDS: { key: string; label: string; synonyms: string[] }[] = [
  { key: "name", label: "Название / ФИО *", synonyms: ["название", "наименование", "клиент", "компания", "контрагент", "фио", "имя", "name"] },
  { key: "fullName", label: "Полное наименование", synonyms: ["полное наименование", "полное название", "full name"] },
  { key: "inn", label: "ИНН", synonyms: ["инн", "inn"] },
  { key: "kpp", label: "КПП", synonyms: ["кпп", "kpp"] },
  { key: "ogrn", label: "ОГРН", synonyms: ["огрн", "огрнип", "ogrn"] },
  { key: "okpo", label: "ОКПО", synonyms: ["окпо", "okpo"] },
  { key: "phone", label: "Телефон", synonyms: ["телефон", "тел", "phone", "моб", "мобильный"] },
  { key: "email", label: "Email", synonyms: ["email", "e-mail", "почта", "эл. почта", "mail"] },
  { key: "legalAddress", label: "Адрес", synonyms: ["адрес", "юридический адрес", "address"] },
  { key: "notes", label: "Примечание", synonyms: ["примечание", "комментарий", "заметки", "note", "comment"] },
];

type Row = Record<string, string>;
type Mapping = Record<string, string>; // field -> header ("" = не импортировать)

export default function ImportClientsModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number; errors: { row: number; reason: string }[] } | null>(null);

  function reset() {
    setHeaders([]);
    setRows([]);
    setMapping({});
    setError("");
    setResult(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function onFile(file: File) {
    setParsing(true);
    setError("");
    setResult(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "", raw: false });
      const nonEmpty = grid.filter((r) => r.some((c) => String(c).trim() !== ""));
      if (nonEmpty.length < 2) {
        setError("В файле нет данных — нужна строка заголовков и хотя бы одна строка.");
        return;
      }
      const hdrs = nonEmpty[0].map((h) => String(h).trim());
      const data: Row[] = nonEmpty.slice(1, 5001).map((r) => {
        const o: Row = {};
        hdrs.forEach((h, i) => (o[h] = String(r[i] ?? "").trim()));
        return o;
      });

      // Авто-сопоставление: по совпадению заголовка с синонимами поля.
      const auto: Mapping = {};
      for (const f of FIELDS) {
        const hit = hdrs.find((h) => f.synonyms.includes(h.toLowerCase()));
        auto[f.key] = hit ?? "";
      }
      setHeaders(hdrs);
      setRows(data);
      setMapping(auto);
    } catch {
      setError("Не удалось прочитать файл. Поддерживаются .xlsx, .xls и .csv.");
    } finally {
      setParsing(false);
    }
  }

  async function runImport() {
    if (!mapping.name) {
      setError("Укажите, в какой колонке название клиента — без него не импортировать.");
      return;
    }
    setImporting(true);
    setError("");
    const clients = rows
      .map((r) => {
        const o: Row = {};
        for (const f of FIELDS) {
          const h = mapping[f.key];
          if (h && r[h] !== undefined) o[f.key] = r[h];
        }
        return o;
      })
      .filter((o) => (o.name ?? "").trim() !== "");

    if (clients.length === 0) {
      setError("После сопоставления не осталось строк с названием.");
      setImporting(false);
      return;
    }

    try {
      const res = await fetch("/api/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clients }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Не удалось импортировать");
        return;
      }
      setResult(data);
    } finally {
      setImporting(false);
    }
  }

  const mappedFields = FIELDS.filter((f) => mapping[f.key]);

  return (
    <Modal isOpen={open} onClose={close} title="Импорт клиентов из Excel" size="lg">
      {/* Результат */}
      {result ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
            Добавлено: <b>{result.created}</b>. Пропущено дублей: <b>{result.skipped}</b>.
            {result.errors.length > 0 && <> Пропущено с ошибкой: <b>{result.errors.length}</b>.</>}
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-line bg-surface-sunken p-3 text-xs text-fg-muted">
              {result.errors.slice(0, 50).map((e) => (
                <div key={e.row}>Строка {e.row}: {e.reason}</div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={onDone}>Готово</Button>
          </div>
        </div>
      ) : headers.length === 0 ? (
        // Шаг 1 — загрузка файла
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">
            Загрузите файл со списком клиентов. Первая строка — заголовки колонок
            (Название, ИНН, Телефон и т. д.). Дубли по ИНН и телефону пропустятся сами.
          </p>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface-sunken px-6 py-10 text-center transition-colors hover:border-accent/40">
            {parsing ? (
              <Loader2 size={28} className="animate-spin text-accent" />
            ) : (
              <FileSpreadsheet size={28} className="text-fg-subtle" />
            )}
            <span className="text-sm font-medium text-fg">Выбрать файл</span>
            <span className="text-xs text-fg-subtle">.xlsx, .xls или .csv</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </label>
        </div>
      ) : (
        // Шаг 2 — сопоставление колонок и предпросмотр
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">
            Нашли {rows.length} строк. Проверьте, какая колонка файла соответствует полю —
            что не нужно, оставьте «не импортировать».
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <span className="w-40 shrink-0 text-fg-muted">{f.label}</span>
                <select
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                  className="h-9 flex-1 rounded-lg border border-line bg-surface px-2 text-[13px] text-fg focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
                >
                  <option value="">— не импортировать</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {mappedFields.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-line-soft">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line-soft bg-surface-sunken text-left text-fg-muted">
                    {mappedFields.map((f) => (
                      <th key={f.key} className="whitespace-nowrap px-2 py-1.5 font-medium">{f.label.replace(" *", "")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      {mappedFields.map((f) => (
                        <td key={f.key} className="whitespace-nowrap px-2 py-1.5 text-fg-muted">
                          {r[mapping[f.key]] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-between">
            <Button variant="outline" onClick={reset}>Другой файл</Button>
            <Button onClick={runImport} loading={importing} disabled={!mapping.name}>
              {importing ? "Импорт..." : <>Импортировать {rows.length} <ArrowRight size={16} /></>}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
