"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { Plus, Zap, Edit3, Trash2 } from "lucide-react";

interface QuickReply {
  id: string;
  title: string;
  text: string;
  sortOrder: number;
}

const emptyForm = { title: "", text: "" };

export default function QuickRepliesPage() {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/quick-replies")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setReplies(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(r: QuickReply) {
    setEditing(r);
    setForm({ title: r.title, text: r.text });
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const url = editing
        ? `/api/settings/quick-replies/${editing.id}`
        : "/api/settings/quick-replies";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title.trim(), text: form.text.trim() }),
      });
      if (!res.ok) {
        setError("Не удалось сохранить заготовку");
        return;
      }
      const saved: QuickReply = await res.json();
      setReplies((prev) =>
        editing ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved],
      );
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: QuickReply) {
    if (!confirm(`Удалить заготовку «${r.title}»?`)) return;
    const res = await fetch(`/api/settings/quick-replies/${r.id}`, { method: "DELETE" });
    if (res.ok) setReplies((prev) => prev.filter((x) => x.id !== r.id));
  }

  if (loading) return <div className="p-6 text-fg-subtle">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Zap size={18} />}
        title="Быстрые ответы"
        subtitle="Заготовки для переписки — вставляются в одно нажатие"
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Добавить заготовку
          </Button>
        }
      />

      {replies.length === 0 ? (
        <Card padding="md">
          <div className="py-12 text-center text-fg-subtle">
            <Zap size={36} className="mx-auto mb-2 opacity-30" />
            <p>Заготовок пока нет</p>
            <p className="mx-auto mt-2 max-w-md text-xs">
              Фразы, которые менеджер пишет каждый день: «макет принят, срок 3 дня»,
              «счёт отправлен на почту», реквизиты для оплаты.
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-line-soft">
            {replies.map((r) => (
              <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">{r.title}</p>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-fg-muted">
                    {r.text}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(r)}
                    title="Изменить"
                    className="rounded p-1.5 text-fg-muted hover:bg-surface-hover"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    title="Удалить"
                    className="rounded p-1.5 text-fg-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Изменить заготовку" : "Новая заготовка"}
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <Input
            label="Название *"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="Макет принят"
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-fg">Текст *</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
              rows={5}
              placeholder="Макет принят в работу. Срок изготовления — 3 рабочих дня."
              className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!form.title.trim() || !form.text.trim()}
            >
              {editing ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
