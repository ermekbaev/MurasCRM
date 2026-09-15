"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { FileSignature, Download, Printer } from "lucide-react";

interface Template {
  id: string;
  name: string;
  type: string;
  kind: string;
  isDefault: boolean;
}

/**
 * Накладная по своему Word-бланку.
 *
 * Встроенные ТОРГ-12 и УПД живут в коде, и поправить их самому нельзя. Поэтому
 * заказчик правит бланк в Word и загружает его с типом «Бланк накладной» — а
 * здесь по нему формируется документ с данными этой накладной.
 */
export default function WaybillBlankBuilder({
  waybillId,
  waybillNumber,
}: {
  waybillId: string;
  waybillNumber: string;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [withStamp, setWithStamp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Template[]) => {
        const list = (Array.isArray(data) ? data : []).filter(
          (t) => t.kind === "DOCX" && t.type === "WAYBILL",
        );
        setTemplates(list);
        const preferred = list.find((t) => t.isDefault) ?? list[0];
        if (preferred) setTemplateId(preferred.id);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const selected = templates.find((t) => t.id === templateId);

  async function render(mode: "docx" | "pdf" | "print") {
    if (!templateId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${templateId}/render-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waybillId,
          withStamp,
          format: mode === "docx" ? "docx" : "pdf",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(typeof body?.error === "string" ? body.error : "Не удалось заполнить бланк");
        return;
      }
      const warning = res.headers.get("X-Image-Warning");
      if (warning) setError(decodeURIComponent(warning));

      const url = URL.createObjectURL(await res.blob());

      if (mode === "print") {
        // Печатать .docx браузер не умеет — открываем PDF и зовём печать.
        const w = window.open(url, "_blank");
        if (!w) {
          setError("Браузер заблокировал окно — разрешите всплывающие окна");
          URL.revokeObjectURL(url);
          return;
        }
        w.addEventListener("load", () => w.print(), { once: true });
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }

      const a = document.createElement("a");
      a.href = url;
      a.download = `${selected?.name ?? "Накладная"} — ${waybillNumber}.${mode}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface-sunken px-4 py-3 text-xs text-fg-muted">
        Нужна своя форма накладной? Скачайте{" "}
        <a href="/templates/torg12-blank.docx" download className="text-accent hover:underline">
          готовый бланк ТОРГ-12 в Word
        </a>
        , поправьте его как нужно и загрузите в Настройки → Шаблоны с типом «Бланк
        накладной». Он появится здесь, и накладные можно будет формировать по нему.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">Свой бланк накладной</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            Word-бланк из Настроек — данные этой накладной подставятся в него
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="h-9.5 rounded-lg border border-line bg-surface px-3 text-[13px] text-fg outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isDefault ? " ★" : ""}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-fg-muted">
            <input
              type="checkbox"
              checked={withStamp}
              onChange={(e) => setWithStamp(e.target.checked)}
              className="rounded border-line"
            />
            С печатью и подписью
          </label>
          <Button variant="outline" onClick={() => render("docx")} loading={busy}>
            <FileSignature size={16} /> Word
          </Button>
          <Button variant="outline" onClick={() => render("pdf")} loading={busy}>
            <Download size={16} /> PDF
          </Button>
          <Button variant="outline" onClick={() => render("print")} loading={busy}>
            <Printer size={16} /> Печать
          </Button>
        </div>
      </div>
    </div>
  );
}
