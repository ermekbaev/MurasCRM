"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";

interface Doc {
  id: string;
  number: string;
}

interface Template {
  id: string;
  name: string;
  type: string;
  kind: string;
}

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  orderId: string | null;
  items: { name: string; qty: number; unit: string; price: number }[];
  waybills: Doc[];
  acts: Doc[];
}

const TYPE_LABELS: Record<string, string> = {
  INVOICE: "счёт",
  ACT: "акт",
  CONTRACT: "договор",
  COMMERCIAL_OFFER: "КП",
  WAYBILL: "накладная",
  OTHER: "другое",
};

/**
 * Меню «Документ ▾» на странице счёта — как в Битриксе у Сергея из DASS (26.11): один список, что сформировать
 * на основе этого счёта. УПД, ТОРГ-12 и акт: если по счёту уже есть — открываем его, нет — создаём из счёта
 * (чтобы не плодить копии от случайных нажатий; ещё один документ можно сделать в блоке «Документы по счёту»).
 * Ниже — свои бланки Word (договор и прочие), заполняются клиентом и позициями счёта, отдаются PDF.
 */
export default function InvoiceDocumentMenu({ invoiceId, invoiceNumber, clientId, orderId, items, waybills, acts }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // клик мимо и Esc закрывают меню
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // бланки грузим при первом открытии меню, а не вместе со страницей
  useEffect(() => {
    if (!open || templates) return;
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Template[]) => setTemplates(Array.isArray(list) ? list.filter((t) => t.kind === "DOCX") : []))
      .catch(() => setTemplates([]));
  }, [open, templates]);

  async function createFromInvoice(kind: "waybill" | "act"): Promise<string | null> {
    const body =
      kind === "waybill"
        ? { invoiceId, ...(orderId ? { orderId } : {}) }
        : { invoiceId, ...(orderId ? { orderId } : {}), items };
    const res = await fetch(kind === "waybill" ? "/api/waybills" : "/api/acts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setError(typeof b?.error === "string" ? b.error : kind === "waybill" ? "Не удалось создать УПД" : "Не удалось создать акт");
      return null;
    }
    return (await res.json()).id as string;
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setBusy(null);
    }
  }

  // последний УПД/акт по счёту, иначе новый
  const lastWaybill = waybills[waybills.length - 1];
  const lastAct = acts[acts.length - 1];

  const openWaybill = (form: "upd" | "torg12") =>
    run(form, async () => {
      const id = lastWaybill?.id ?? (await createFromInvoice("waybill"));
      if (id) window.location.href = `/waybills/${id}?form=${form}`;
    });

  const openAct = () =>
    run("act", async () => {
      const id = lastAct?.id ?? (await createFromInvoice("act"));
      if (id) window.location.href = `/acts/${id}`;
    });

  const downloadXml = () =>
    run("xml", async () => {
      const id = lastWaybill?.id ?? (await createFromInvoice("waybill"));
      if (!id) return;
      const res = await fetch(`/api/waybills/${id}/upd-xml`);
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        setError(typeof b?.error === "string" ? b.error : "Не удалось сформировать XML");
        return;
      }
      saveBlob(await res.blob(), res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `upd-${invoiceNumber}.xml`);
      setOpen(false);
      // XML мог создать УПД — обновим страницу, чтобы он появился в списке документов
      if (!lastWaybill) window.location.reload();
    });

  const renderTemplate = (t: Template) =>
    run("t" + t.id, async () => {
      const res = await fetch(`/api/templates/${t.id}/render-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, clientId, orderId: orderId ?? undefined, waybillId: lastWaybill?.id, format: "pdf" }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        setError(typeof b?.error === "string" ? b.error : "Не удалось заполнить бланк");
        return;
      }
      saveBlob(await res.blob(), `${t.name} по счёту ${invoiceNumber}.pdf`);
      setOpen(false);
    });

  const item = (key: string, label: string, hint: string | null, onClick: () => void) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      disabled={busy !== null}
      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-fg hover:bg-surface-sunken disabled:opacity-60"
    >
      <span>{label}</span>
      {busy === key ? <Loader2 size={14} className="animate-spin text-fg-muted" /> : hint && <span className="text-xs text-fg-subtle">{hint}</span>}
    </button>
  );

  return (
    <div ref={rootRef} className="relative">
      <Button variant="outline" onClick={() => setOpen((v) => !v)}>
        <FileText size={16} /> Документ <ChevronDown size={14} />
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg">
          {item("upd", "УПД", lastWaybill ? `№ ${lastWaybill.number}` : "создать", () => openWaybill("upd"))}
          {item("torg12", "Накладная ТОРГ-12", lastWaybill ? `№ ${lastWaybill.number}` : "создать", () => openWaybill("torg12"))}
          {item("act", "Акт", lastAct ? `№ ${lastAct.number}` : "создать", openAct)}
          {item("xml", "XML УПД для ЭДО", null, downloadXml)}
          <div className="my-1 border-t border-line" />
          <p className="px-3 pt-1 pb-0.5 text-[11px] uppercase tracking-wide text-fg-subtle">Ваши бланки</p>
          {templates === null ? (
            <p className="px-3 py-2 text-xs text-fg-muted">Загружаем…</p>
          ) : templates.length === 0 ? (
            <p className="px-3 py-2 text-xs text-fg-muted">Бланков Word пока нет. Загрузите договор и другие в «Настройки → Шаблоны»</p>
          ) : (
            templates.map((t) => item("t" + t.id, t.name, TYPE_LABELS[t.type] ?? null, () => renderTemplate(t)))
          )}
          {error && <p className="border-t border-line px-3 py-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
      {!open && error && <p className="absolute right-0 mt-1 w-72 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
