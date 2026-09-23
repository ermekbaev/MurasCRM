"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { Plus, Receipt, Edit3, Trash2 } from "lucide-react";
import type { ExpenseCategory } from "@/lib/money";

const emptyForm = { name: "", isActive: true };

/** Подсказка для пустого списка: с чего обычно начинают. */
const EXAMPLES = "Аренда, Закупка материалов, Реклама, Зарплата, Налоги, Хозрасходы";

export default function ExpenseCategoriesPage() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/expense-categories")
      .then((r) => r.json())
      .then((data) => {
        setCategories(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(c: ExpenseCategory) {
    setEditing(c);
    setForm({ name: c.name, isActive: c.isActive });
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const url = editing
        ? `/api/settings/expense-categories/${editing.id}`
        : "/api/settings/expense-categories";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      });
      if (!res.ok) {
        setError("Не удалось сохранить статью");
        return;
      }
      const saved: ExpenseCategory = await res.json();
      setCategories((prev) =>
        editing ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved],
      );
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: ExpenseCategory) {
    if (!confirm(`Удалить статью «${c.name}»?`)) return;
    const res = await fetch(`/api/settings/expense-categories/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      setCategories((prev) => prev.filter((x) => x.id !== c.id));
      return;
    }
    const body = await res.json().catch(() => null);
    alert(body?.error ?? "Не удалось удалить статью");
  }

  if (loading) return <div className="p-6 text-fg-subtle">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Receipt size={18} />}
        title="Статьи расходов"
        subtitle="На что уходят деньги — разбивка в отчёте строится по этому списку"
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Добавить статью
          </Button>
        }
      />

      {categories.length === 0 ? (
        <Card padding="md">
          <div className="py-12 text-center text-fg-subtle">
            <Receipt size={36} className="mx-auto mb-2 opacity-30" />
            <p>Статей пока нет</p>
            <p className="mt-1 text-xs">Например: {EXAMPLES}</p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-line-soft">
            {categories.map((c) => (
              <div key={c.id} className="group flex items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate font-medium text-fg">{c.name}</span>
                  {!c.isActive && (
                    <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-fg-muted">
                      Скрыта
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(c)}
                    title="Переименовать"
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
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Редактировать статью" : "Новая статья"}
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
            placeholder="Аренда, Закупка материалов, Реклама..."
          />

          <label className="flex items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="rounded border-line"
            />
            Доступна при записи расхода
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
