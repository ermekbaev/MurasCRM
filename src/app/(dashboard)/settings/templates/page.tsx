"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, FileCode, Edit3, Trash2, Eye, Copy, Check } from "lucide-react";

interface Template {
  id: string;
  name: string;
  type: string;
  body: string;
  variables: string[];
  isDefault: boolean;
  createdAt: string;
}

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  INVOICE: "Счёт на оплату",
  ACT: "Акт выполненных работ",
  CONTRACT: "Договор",
  OTHER: "Другое",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState({ name: "", type: "INVOICE", body: "" });

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

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, variables }),
    });

    if (res.ok) {
      const data = await res.json();
      if (editingTemplate) {
        setTemplates((prev) => prev.map((t) => (t.id === data.id ? data : t)));
      } else {
        setTemplates((prev) => [...prev, data]);
      }
      setModalOpen(false);
      setEditingTemplate(null);
      setForm({ name: "", type: "INVOICE", body: "" });
    }
    setCreateLoading(false);
  }

  function openEdit(t: Template) {
    setEditingTemplate(t);
    setForm({ name: t.name, type: t.type, body: t.body });
    setModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить шаблон?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) return <div className="p-6 text-gray-400 dark:text-slate-500">Загрузка...</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <FileCode size={22} /> Шаблоны документов
        </h1>
        <Button onClick={() => { setEditingTemplate(null); setForm({ name: "", type: "INVOICE", body: "" }); setModalOpen(true); }}>
          <Plus size={16} /> Новый шаблон
        </Button>
      </div>

      <p className="text-sm text-gray-500 dark:text-slate-400">
        Используйте переменные в шаблонах: <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-xs">{"{{client_name}}"}</code>, <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-xs">{"{{order_number}}"}</code>, <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-xs">{"{{total}}"}</code>, <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-xs">{"{{date}}"}</code>
      </p>

      {templates.length === 0 ? (
        <Card padding="md" className="text-center py-12">
          <FileCode size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 dark:text-slate-500 text-sm">Шаблонов пока нет</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map((t) => (
            <Card key={t.id} padding="md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-slate-200">{t.name}</p>
                  <span className="text-xs px-2 py-0.5 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full mt-1 inline-block">
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
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-500">
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
                    <code key={v} className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                      {`{{${v}}}`}
                    </code>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 line-clamp-2">{t.body.replace(/<[^>]*>/g, "")}</p>
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
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Укажите ID заявки, счёта или клиента для подстановки переменных. Все поля необязательны.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-slate-400 block mb-1">ID заявки</label>
              <input
                type="text"
                value={previewCtx.orderId}
                onChange={(e) => setPreviewCtx({ ...previewCtx, orderId: e.target.value })}
                placeholder="cuid..."
                className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-slate-400 block mb-1">ID счёта</label>
              <input
                type="text"
                value={previewCtx.invoiceId}
                onChange={(e) => setPreviewCtx({ ...previewCtx, invoiceId: e.target.value })}
                placeholder="cuid..."
                className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-slate-400 block mb-1">ID клиента</label>
              <input
                type="text"
                value={previewCtx.clientId}
                onChange={(e) => setPreviewCtx({ ...previewCtx, clientId: e.target.value })}
                placeholder="cuid..."
                className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
              />
            </div>
          </div>
          <div className="flex justify-between items-center">
            <Button type="submit" loading={previewLoading} size="sm">Применить</Button>
            {previewResult && (
              <button type="button" onClick={copyResult} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 transition-colors">
                {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                {copied ? "Скопировано" : "Копировать"}
              </button>
            )}
          </div>
          {previewResult !== null && (
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-slate-400 block mb-1">Результат</label>
              <pre className="w-full px-3 py-3 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800/50 whitespace-pre-wrap font-mono min-h-32 max-h-96 overflow-y-auto">
                {previewResult}
              </pre>
            </div>
          )}
        </form>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingTemplate ? "Редактировать шаблон" : "Новый шаблон"} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Название *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select
              label="Тип"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={Object.entries(TEMPLATE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 block mb-1">Содержимое шаблона *</label>
            <textarea
              required
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={10}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
              placeholder={"Счёт на оплату №{{order_number}}\n\nКлиент: {{client_name}}\nДата: {{date}}\nСумма: {{total}} руб."}
            />
          </div>
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
