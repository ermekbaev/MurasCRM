"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { FileSignature, Copy, Check, Download, Paperclip } from "lucide-react";

interface Template {
  id: string;
  name: string;
  type: string;
  kind: string;
  isDefault: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  INVOICE: "Письмо по счёту",
  ACT: "Письмо по акту",
  CONTRACT: "Договор",
  COMMERCIAL_OFFER: "КП",
  OTHER: "Другое",
};

export default function OrderDocumentBuilder({
  orderId,
  orderNumber,
  onSaved,
}: {
  orderId: string;
  orderNumber: string;
  /** Файл прикреплён к заявке — родитель обновляет список файлов. */
  onSaved: (orderFile: unknown) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [rendering, setRendering] = useState(false);
  const [withStamp, setWithStamp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isOpen, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [attached, setAttached] = useState(false);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Template[]) => {
        const list = Array.isArray(data) ? data : [];
        setTemplates(list);
        // Отмеченный по умолчанию выбирается сам — иначе каждый раз
        // приходится искать нужный в списке.
        const preferred = list.find((t) => t.isDefault) ?? list[0];
        if (preferred) setTemplateId((prev) => prev || preferred.id);
      })
      .catch(() => {});
  }, []);

  const selected = templates.find((t) => t.id === templateId);

  /**
   * DOCX-бланк заполняется на сервере и сразу отдаётся файлом: показывать
   * его текстом бессмысленно, вся ценность в сохранённой вёрстке.
   */
  async function handleRenderDocx() {
    setRendering(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${templateId}/render-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, withStamp }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        setError(typeof b?.error === "string" ? b.error : "Не удалось заполнить бланк");
        return;
      }
      const warning = res.headers.get("X-Image-Warning");
      if (warning) setError(decodeURIComponent(warning));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selected?.name ?? "Документ"} — ${orderNumber}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setRendering(false);
    }
  }

  async function handleRender() {
    if (!templateId) return;
    if (selected?.kind === "DOCX") return handleRenderDocx();
    setRendering(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${templateId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) {
        setError("Не удалось собрать документ");
        return;
      }
      const { rendered } = await res.json();
      setTitle(templates.find((t) => t.id === templateId)?.name || "Документ");
      setText(rendered);
      setCopied(false);
      setAttached(false);
      setOpen(true);
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setRendering(false);
    }
  }

  function fileName() {
    return `${title} — ${orderNumber}.pdf`;
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const { downloadDocumentPDF } = await import("@/lib/document-pdf");
      const company = await fetch("/api/settings").then((r) => (r.ok ? r.json() : null));
      await downloadDocumentPDF(title, text, company, fileName());
    } finally {
      setDownloading(false);
    }
  }

  /** Собирает PDF и кладёт его в файлы заявки через обычный upload-поток. */
  async function handleAttach() {
    setAttaching(true);
    setError(null);
    try {
      const [{ buildDocumentPDFBlob }, company] = await Promise.all([
        import("@/lib/document-pdf"),
        fetch("/api/settings").then((r) => (r.ok ? r.json() : null)),
      ]);
      const blob = await buildDocumentPDFBlob(title, text, company);
      const name = fileName();

      const res = await fetch(`/api/orders/${orderId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalName: name,
          mimeType: "application/pdf",
          size: blob.size,
          category: "READY",
          comment: `Сформирован по шаблону «${title}»`,
        }),
      });
      if (!res.ok) {
        setError("Не удалось прикрепить документ к заявке");
        return;
      }

      const { orderFile, uploadUrl } = await res.json();
      if (uploadUrl) {
        try {
          await fetch(uploadUrl, {
            method: "PUT",
            body: blob,
            headers: { "Content-Type": "application/pdf" },
          });
        } catch {
          // Запись о файле создана, но само содержимое не уехало в хранилище.
          setError("Документ записан в заявку, но файл не загрузился в хранилище");
        }
      }
      onSaved(orderFile);
      setAttached(true);
    } finally {
      setAttaching(false);
    }
  }

  if (templates.length === 0) {
    return (
      <Card padding="md">
        <div className="flex items-start gap-3">
          <FileSignature size={18} className="mt-0.5 shrink-0 text-fg-subtle" />
          <div>
            <p className="text-sm font-medium text-fg">Документ по шаблону</p>
            <p className="mt-0.5 text-xs text-fg-muted">
              Шаблонов пока нет. Заведите договор или КП в Настройки → Шаблоны —
              реквизиты и позиции подставятся из этой заявки.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card padding="md">
        {error && !isOpen && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">Документ по шаблону</p>
            <p className="mt-0.5 text-xs text-fg-muted">
              Текст или свой DOCX-бланк — реквизиты и позиции подставятся из этой заявки
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="h-9.5 rounded-lg border border-line bg-surface px-3 text-[13px] text-fg outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {TYPE_LABELS[t.type] || t.type}{t.kind === "DOCX" ? " · DOCX" : ""}{t.isDefault ? " ★" : ""}
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
            <Button onClick={handleRender} loading={rendering}>
              <FileSignature size={16} /> Сформировать
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        title={title}
        description={`По заявке ${orderNumber} · перед сохранением текст можно поправить`}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={handleCopy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Скопировано" : "Копировать"}
            </Button>
            <Button variant="outline" onClick={handleDownload} loading={downloading}>
              <Download size={16} /> Скачать PDF
            </Button>
            <Button onClick={handleAttach} loading={attaching} disabled={attached}>
              {attached ? <Check size={16} /> : <Paperclip size={16} />}
              {attached ? "В файлах заявки" : "Прикрепить к заявке"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
          {text.includes("{{") && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
              В тексте остались неподставленные переменные — проверьте написание
              или заполните недостающие данные (например, реквизиты компании).
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={18}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] leading-relaxed text-fg outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
          />
        </div>
      </Modal>
    </>
  );
}
