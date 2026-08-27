"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { Plus, Megaphone, Edit3, Trash2 } from "lucide-react";

interface SourceOption {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

const emptyForm = { label: "", isActive: true };

export default function ClientSourcesPage() {
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SourceOption | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/client-sources")
      .then((r) => r.json())
      .then((data) => {
        setSources(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(s: SourceOption) {
    setEditing(s);
    setForm({ label: s.label, isActive: s.isActive });
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.label.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const url = editing
        ? `/api/settings/client-sources/${editing.id}`
        : "/api/settings/client-sources";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, label: form.label.trim() }),
      });
      if (!res.ok) {
        setError("Не удалось сохранить источник");
        return;
      }
      const saved: SourceOption = await res.json();
      setSources((prev) =>
        editing ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved],
      );
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: SourceOption) {
    if (!confirm(`Удалить источник «${s.label}»?`)) return;
    const res = await fetch(`/api/settings/client-sources/${s.id}`, { method: "DELETE" });
    if (res.ok) {
      setSources((prev) => prev.filter((x) => x.id !== s.id));
      return;
    }
    const body = await res.json().catch(() => null);
    alert(body?.error ?? "Не удалось удалить источник");
  }

  if (loading) return <div className="p-6 text-fg-subtle">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Megaphone size={18} />}
        title="Источники клиентов"
        subtitle="Откуда пришёл клиент — список доступен при заполнении карточки"
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Добавить источник
          </Button>
        }
      />

      {sources.length === 0 ? (
        <Card padding="md">
          <div className="py-12 text-center text-fg-subtle">
            <Megaphone size={36} className="mx-auto mb-2 opacity-30" />
            <p>Источников пока нет</p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-line-soft">
            {sources.map((s) => (
              <div key={s.id} className="group flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-fg">{s.label}</span>
                    {!s.isActive && (
                      <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-fg-muted">
                        Скрыт
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-fg-subtle">{s.code}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(s)}
                    title="Переименовать"
                    className="rounded p-1.5 text-fg-muted hover:bg-surface-hover"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
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
        title={editing ? "Редактировать источник" : "Новый источник"}
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <Input
            label="Название *"
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            placeholder="Выставка, Сайт, Партнёр..."
          />

          <label className="flex items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="rounded border-line"
            />
            Доступен при заполнении карточки клиента
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.label.trim()}>
              {editing ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
