"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { Plus, Columns3, Edit3, Trash2, ArrowUp, ArrowDown } from "lucide-react";

interface TaskColumn {
  id: string;
  code: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  isStart: boolean;
  isFinal: boolean;
}

const PRESET_COLORS = [
  "#64748b", "#0ea5e9", "#8b5cf6", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#84cc16",
];

const emptyForm = {
  name: "",
  color: PRESET_COLORS[0],
  isActive: true,
  isStart: false,
  isFinal: false,
};

export default function TaskColumnsPage() {
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaskColumn | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/task-columns")
      .then((r) => r.json())
      .then((data) => {
        setColumns(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(c: TaskColumn) {
    setEditing(c);
    setForm({
      name: c.name,
      color: c.color ?? PRESET_COLORS[0],
      isActive: c.isActive,
      isStart: c.isStart,
      isFinal: c.isFinal,
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const url = editing
        ? `/api/settings/task-columns/${editing.id}`
        : "/api/settings/task-columns";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      });
      if (!res.ok) {
        setError("Не удалось сохранить этап");
        return;
      }
      const saved: TaskColumn = await res.json();
      setColumns((prev) =>
        editing ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved],
      );
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: TaskColumn) {
    if (!confirm(`Удалить этап «${c.name}»?`)) return;
    const res = await fetch(`/api/settings/task-columns/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      setColumns((prev) => prev.filter((x) => x.id !== c.id));
      return;
    }
    const body = await res.json().catch(() => null);
    alert(body?.error ?? "Не удалось удалить этап");
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= columns.length) return;

    const next = [...columns];
    [next[index], next[target]] = [next[target], next[index]];
    setColumns(next); // оптимистично, сервер вернёт канонический порядок

    const res = await fetch("/api/settings/task-columns", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((c) => c.id) }),
    });
    if (res.ok) setColumns(await res.json());
  }

  if (loading) return <div className="p-6 text-fg-subtle">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Columns3 size={18} />}
        title="Этапы задач"
        subtitle="Колонки канбан-доски — порядок, названия и цвета настраиваются здесь"
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Добавить этап
          </Button>
        }
      />

      <Card padding="none">
        <div className="divide-y divide-line-soft">
          {columns.map((c, i) => (
            <div key={c.id} className="group flex items-center gap-3 px-4 py-3">
              <span
                className="h-7 w-1.5 shrink-0 rounded-full"
                style={{ background: c.color ?? "#64748b" }}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium text-fg">{c.name}</span>
                  {c.isStart && (
                    <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25">
                      старт работы
                    </span>
                  )}
                  {c.isFinal && (
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
                      завершение
                    </span>
                  )}
                  {!c.isActive && (
                    <span className="rounded-md bg-surface-hover px-1.5 py-0.5 text-[11px] text-fg-muted">
                      скрыт
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs text-fg-subtle">{c.code}</span>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  title="Выше"
                  className="rounded p-1.5 text-fg-muted hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === columns.length - 1}
                  title="Ниже"
                  className="rounded p-1.5 text-fg-muted hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  onClick={() => openEdit(c)}
                  title="Редактировать"
                  className="rounded p-1.5 text-fg-muted hover:bg-surface-hover"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => handleDelete(c)}
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

      <p className="text-xs text-fg-subtle">
        «Старт работы» отмечает время начала задачи, «завершение» — время закрытия.
        Эти отметки используются в аналитике, поэтому лучше держать по одному такому этапу.
      </p>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Редактировать этап" : "Новый этап"}
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <Input
            label="Название *"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Согласование, Печать, Упаковка..."
          />

          <div>
            <p className="mb-1.5 text-xs font-medium text-fg-muted">Цвет</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, color }))}
                  aria-label={color}
                  className={`h-7 w-7 rounded-lg transition-transform ${
                    form.color === color ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "hover:scale-110"
                  }`}
                  style={{ background: color }}
                />
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="rounded border-line"
            />
            Показывать на доске
          </label>

          <label className="flex items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={form.isStart}
              onChange={(e) => setForm((p) => ({ ...p, isStart: e.target.checked }))}
              className="rounded border-line"
            />
            Отмечать начало работы над задачей
          </label>

          <label className="flex items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={form.isFinal}
              onChange={(e) => setForm((p) => ({ ...p, isFinal: e.target.checked }))}
              className="rounded border-line"
            />
            Завершающий этап (задача считается закрытой)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name.trim()}>
              {editing ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
