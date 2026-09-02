"use client";

import { useState, useEffect, useRef } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { DOCUMENT_VAR_UI_GROUPS, DOCUMENT_VARS } from "@/lib/documentVars";
import PageHeader from "@/components/layout/PageHeader";
import { Plus, FileCode, Edit3, Trash2, Eye, Copy, Check } from "lucide-react";

interface Template {
  id: string;
  name: string;
  type: string;
  kind: string;
  body: string;
  fileName: string | null;
  variables: string[];
  isDefault: boolean;
  createdAt: string;
}

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  INVOICE: "Письмо по счёту",
  ACT: "Письмо по акту",
  CONTRACT: "Договор",
  COMMERCIAL_OFFER: "Коммерческое предложение",
  OTHER: "Другое",
};


export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState({ name: "", type: "INVOICE", kind: "TEXT", body: "" });
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [docxName, setDocxName] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [unknownVars, setUnknownVars] = useState<string[]>([]);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  /** Как переменная выглядит в шаблоне: в DOCX скобки одинарные. */
  function varToken(key: string) {
    return form.kind === "DOCX" ? `{${key}}` : `{{${key}}}`;
  }

  /**
   * В текстовом шаблоне вставляем в позицию курсора. В DOCX вставлять некуда —
   * бланк редактируется в Word, поэтому копируем в буфер обмена.
   */
  async function pickVar(key: string) {
    const token = varToken(key);
    if (form.kind === "DOCX") {
      await navigator.clipboard.writeText(token).catch(() => {});
      setCopiedVar(key);
      setTimeout(() => setCopiedVar(null), 1500);
      return;
    }
    insertVar(key);
  }

  /** Вставляет переменную в позицию курсора, а не в конец текста. */
  function insertVar(key: string) {
    const token = `{{${key}}}`;
    const el = bodyRef.current;
    if (!el) {
      setForm((f) => ({ ...f, body: f.body + token }));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    setForm((f) => ({ ...f, body: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  // Preview
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewCtx, setPreviewCtx] = useState({ orderId: "", invoiceId: "", clientId: "" });
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!previewTemplate) return;
    setPreviewLoading(true);
    setPreviewResult(null);
    const res = await fetch(`/api/templates/${previewTemplate.id}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(previewCtx),
    });
    if (res.ok) {
      const { rendered } = await res.json();
      setPreviewResult(rendered);
    }
    setPreviewLoading(false);
  }

  function copyResult() {
    if (!previewResult) return;
    navigator.clipboard.writeText(previewResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => { setTemplates(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);

    const variables = (form.body.match(/\{\{([^}]+)\}\}/g) || []).map(
      (v) => v.slice(2, -2).trim()
    );

    const method = editingTemplate ? "PATCH" : "POST";
    const url = editingTemplate ? `/api/templates/${editingTemplate.id}` : "/api/templates";

    // Бланк уходит через наш сервер: он проверяет файл и кладёт его
    // в хранилище сам. Прямой PUT из браузера R2 отклоняет без CORS.
    let fileKey: string | undefined;
    let fileName: string | undefined;
    if (form.kind === "DOCX" && docxFile) {
      const fd = new FormData();
      fd.append("file", docxFile);
      const up = await fetch("/api/templates/upload", { method: "POST", body: fd }).catch(
        () => null,
      );
      if (!up || !up.ok) {
        const b = await up?.json().catch(() => null);
        setSaveError(
          typeof b?.error === "string" ? b.error : "Не удалось загрузить бланк",
        );
        setCreateLoading(false);
        return;
      }
      const uploaded = await up.json();
      fileKey = uploaded.key;
      fileName = uploaded.fileName;
      if (uploaded.unknownVars?.length) {
        setUnknownVars(uploaded.unknownVars);
      }
    }
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, variables, ...(fileKey ? { fileKey, fileName } : {}) }),
    });

    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setSaveError(typeof b?.error === "string" ? b.error : "Не удалось сохранить шаблон");
    }

    if (res.ok) {
      const data = await res.json();
      if (editingTemplate) {
        setTemplates((prev) => prev.map((t) => (t.id === data.id ? data : t)));
      } else {
        setTemplates((prev) => [...prev, data]);
      }
      setModalOpen(false);
      setEditingTemplate(null);
      setForm({ name: "", type: "INVOICE", kind: "TEXT", body: "" });
      setDocxFile(null);
      setDocxName(null);
      setUnknownVars([]);
    }
    setCreateLoading(false);
  }

  function openEdit(t: Template) {
    setEditingTemplate(t);
    setForm({ name: t.name, type: t.type, kind: t.kind || "TEXT", body: t.body });
    setDocxFile(null);
    setDocxName(t.fileName);
    setSaveError(null);
    setModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить шаблон?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) return <div className="p-6 text-fg-subtle">Загрузка...</div>;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<FileCode size={18} />}
        title="Шаблоны договоров и КП"
        subtitle="Свой DOCX-бланк или текст — данные подставляются из заявки, счёта и настроек компании"
        actions={
          <Button onClick={() => { setEditingTemplate(null); setForm({ name: "", type: "INVOICE", kind: "TEXT", body: "" }); setDocxFile(null); setDocxName(null); setSaveError(null); setModalOpen(true); }}>
            <Plus size={16} /> Новый шаблон
          </Button>
        }
        meta={
          <div className="rounded-lg border border-line bg-surface-sunken px-3 py-2.5 text-xs text-fg-muted">
            Доступно {DOCUMENT_VARS.length} переменных — полный список внутри редактора
            шаблона, вставляются кликом.
            <span className="mt-1 block text-fg-subtle">
              Печатные формы счёта, акта и накладной здесь не редактируются — у них
              своя фиксированная вёрстка.
            </span>
          </div>
        }
      />


      {templates.length === 0 ? (
        <Card padding="md" className="text-center py-12">
          <FileCode size={40} className="mx-auto text-fg-subtle/50 mb-3" />
          <p className="text-fg-subtle text-sm">Шаблонов пока нет</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map((t) => (
            <Card key={t.id} padding="md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-fg">{t.name}</p>
                  <span className="text-xs px-2 py-0.5 bg-accent-soft text-violet-700 dark:text-accent rounded-full mt-1 inline-block">
                    {TEMPLATE_TYPE_LABELS[t.type] || t.type}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setPreviewTemplate(t); setPreviewCtx({ orderId: "", invoiceId: "", clientId: "" }); setPreviewResult(null); }}
                    className="p-1.5 rounded hover:bg-blue-50 text-blue-400"
                    title="Предпросмотр"
                  >
                    <Eye size={14} />
                  </button>
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-surface-hover text-fg-muted">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {t.variables.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {t.variables.map((v) => (
                    <code key={v} className="text-xs bg-surface-hover text-fg-muted px-1.5 py-0.5 rounded">
                      {`{{${v}}}`}
                    </code>
                  ))}
                </div>
              )}
              <p className="text-xs text-fg-subtle mt-2 line-clamp-2">{t.body.replace(/<[^>]*>/g, "")}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Preview modal */}
      <Modal
        isOpen={!!previewTemplate}
        onClose={() => { setPreviewTemplate(null); setPreviewResult(null); }}
        title={`Предпросмотр: ${previewTemplate?.name ?? ""}`}
        size="lg"
      >
        <form onSubmit={handlePreview} className="space-y-4">
          <p className="text-xs text-fg-muted">
            Укажите ID заявки, счёта или клиента для подстановки переменных. Все поля необязательны.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-fg-muted block mb-1">ID заявки</label>
              <input
                type="text"
                value={previewCtx.orderId}
                onChange={(e) => setPreviewCtx({ ...previewCtx, orderId: e.target.value })}
                placeholder="cuid..."
                className="w-full px-2 py-1.5 text-xs border border-line rounded-lg focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-fg-muted block mb-1">ID счёта</label>
              <input
                type="text"
                value={previewCtx.invoiceId}
                onChange={(e) => setPreviewCtx({ ...previewCtx, invoiceId: e.target.value })}
                placeholder="cuid..."
                className="w-full px-2 py-1.5 text-xs border border-line rounded-lg focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-fg-muted block mb-1">ID клиента</label>
              <input
                type="text"
                value={previewCtx.clientId}
                onChange={(e) => setPreviewCtx({ ...previewCtx, clientId: e.target.value })}
                placeholder="cuid..."
                className="w-full px-2 py-1.5 text-xs border border-line rounded-lg focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 font-mono"
              />
            </div>
          </div>
          <div className="flex justify-between items-center">
            <Button type="submit" loading={previewLoading} size="sm">Применить</Button>
            {previewResult && (
              <button type="button" onClick={copyResult} className="flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg transition-colors">
                {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                {copied ? "Скопировано" : "Копировать"}
              </button>
            )}
          </div>
          {previewResult !== null && (
            <div>
              <label className="text-xs font-medium text-fg-muted block mb-1">Результат</label>
              <pre className="w-full px-3 py-3 text-xs border border-line rounded-lg bg-surface-sunken whitespace-pre-wrap font-mono min-h-32 max-h-96 overflow-y-auto">
                {previewResult}
              </pre>
            </div>
          )}
        </form>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingTemplate ? "Редактировать шаблон" : "Новый шаблон"} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Название *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select
              label="Тип"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={Object.entries(TEMPLATE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
          </div>
          {unknownVars.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
              В бланке есть подстановки, которых нет в справочнике:{" "}
              <span className="font-mono">{unknownVars.join(", ")}</span>. Если это
              опечатка — поправьте в Word и загрузите снова; если ваши пометки —
              оставьте как есть, они останутся в документе.
            </div>
          )}

          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              {saveError}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-fg-muted">Вид шаблона</label>
            <div className="flex rounded-lg border border-line bg-surface p-0.5">
              {([["TEXT", "Текст с переменными"], ["DOCX", "Свой бланк DOCX"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, kind: k })}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    form.kind === k ? "bg-accent-soft text-accent-fg" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.kind === "DOCX" && (
            <div className="space-y-2 rounded-lg border border-line bg-surface-sunken p-3">
              <p className="text-xs text-fg-muted">
                Возьмите свой бланк в Word, впишите в него переменные и загрузите сюда —
                вёрстка документа сохранится полностью.
              </p>
              <p className="text-xs text-fg-subtle">
                В DOCX переменные пишутся <strong>одинарными</strong> скобками:{" "}
                <code className="rounded bg-surface px-1 font-mono">{"{client_name}"}</code>.
                Позиции — циклом на строке таблицы:{" "}
                <code className="rounded bg-surface px-1 font-mono">
                  {"{#items}{n} {name} {qty} {unit} {price} {total}{/items}"}
                </code>
              </p>
              <p className="text-xs text-fg-subtle">
                Печать и подпись вставьте картинкой прямо в бланк — они останутся на месте.
              </p>
              <input
                type="file"
                accept=".docx"
                onChange={(e) => setDocxFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-fg-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent-fg"
              />
              {(docxFile || docxName) && (
                <p className="text-xs text-fg">
                  Файл: <span className="font-medium">{docxFile?.name ?? docxName}</span>
                  {!docxFile && docxName ? " (загружен ранее)" : ""}
                </p>
              )}
            </div>
          )}

          {form.kind === "TEXT" && (
          <div>
            <label className="text-sm font-medium text-fg-muted block mb-1">Содержимое шаблона *</label>
            <textarea
              ref={bodyRef}
              required
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={10}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 font-mono bg-surface text-fg"
              placeholder={"Счёт на оплату №{{order_number}}\n\nКлиент: {{client_name}}\nДата: {{date}}\nСумма: {{total}} руб."}
            />
          </div>
          )}

          <details className="rounded-lg border border-line bg-surface-sunken" open>
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-fg-muted">
              Переменные ({DOCUMENT_VARS.length}) —{" "}
              {form.kind === "DOCX" ? "нажмите, чтобы скопировать" : "нажмите, чтобы вставить"}
            </summary>
            <div className="max-h-64 space-y-4 overflow-y-auto border-t border-line px-3 py-3">
              {DOCUMENT_VAR_UI_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    {group.title}
                    {group.hint && (
                      <span className="ml-2 font-normal normal-case tracking-normal">
                        · {group.hint}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.vars.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => pickVar(v.key)}
                        title={`${v.label} — например: ${v.sample}`}
                        className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-fg transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent-fg"
                      >
                        {copiedVar === v.key ? "скопировано" : varToken(v.key)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button type="submit" loading={createLoading}>
              {editingTemplate ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
