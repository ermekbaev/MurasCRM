"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { Plus, Tag, Edit3, Trash2 } from "lucide-react";

interface TagItem {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b",
  "#10b981", "#06b6d4", "#3b82f6", "#84cc16", "#64748b",
];

const emptyForm = { name: "", color: "#6366f1" };

export default function TagsPage() {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TagItem | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data) => { setTags(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(t: TagItem) {
    setEditing(t);
    setForm({ name: t.name, color: t.color });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/tags/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          const updated = await res.json();
          setTags((prev) => prev.map((t) => t.id === editing.id ? updated : t));
        }
      } else {
        const res = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          const created = await res.json();
          setTags((prev) => [...prev, created]);
        }
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить тег?")) return;
    const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
    if (res.ok) setTags((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) return <div className="p-6 text-gray-400 dark:text-slate-500">Загрузка...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Теги</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Используются для задач и файлов</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Добавить тег
        </Button>
      </div>

      {tags.length === 0 ? (
        <Card padding="md">
          <div className="py-12 text-center text-gray-400 dark:text-slate-500">
            <Tag size={36} className="mx-auto mb-2 opacity-30" />
            <p>Тегов пока нет</p>
          </div>
        </Card>
      ) : (
        <Card padding="md">
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="group flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border text-sm font-medium"
                style={{ borderColor: tag.color, color: tag.color, background: `${tag.color}18` }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: tag.color }}
                />
                {tag.name}
                <div className="flex items-center gap-0.5 ml-1">
                  <button
                    onClick={() => openEdit(tag)}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-all"
                  >
                    <Edit3 size={11} />
                  </button>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-all"
                  >
                    <Trash2 size={11} />
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
        title={editing ? "Редактировать тег" : "Новый тег"}
      >
        <div className="space-y-4">
          <Input
            label="Название *"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Срочно, Дизайн, Печать..."
          />

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Цвет</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((p) => ({ ...p, color: c }))}
                  className={`w-8 h-8 rounded-full transition-transform ${form.color === c ? "scale-125 ring-2 ring-offset-2 ring-gray-400" : "hover:scale-110"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                className="w-10 h-10 rounded cursor-pointer border border-gray-200 dark:border-slate-700"
              />
              <span className="text-sm text-gray-500 dark:text-slate-400">Свой цвет</span>
              <span
                className="ml-2 px-3 py-1 rounded-full text-sm font-medium"
                style={{ background: `${form.color}20`, color: form.color }}
              >
                {form.name || "Предпросмотр"}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name.trim()}>
              {editing ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
