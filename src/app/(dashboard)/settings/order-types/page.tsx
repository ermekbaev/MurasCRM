"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/layout/PageHeader";
import { Plus, Layers, Edit3, Trash2 } from "lucide-react";

interface OrderType {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

const emptyForm = { label: "", isActive: true };

export default function OrderTypesPage() {
  const [types, setTypes] = useState<OrderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrderType | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetch("/api/order-types")
      .then((r) => r.json())
      .then((data) => { setTypes(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(t: OrderType) {
    setEditing(t);
    setForm({ label: t.label, isActive: t.isActive });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.label.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/order-types/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          const updated = await res.json();
          setTypes((prev) => prev.map((t) => t.id === editing.id ? updated : t));
        }
      } else {
        const res = await fetch("/api/order-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          const created = await res.json();
          setTypes((prev) => [...prev, created]);
        }
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: OrderType) {
    if (!confirm(`Удалить тип «${t.label}»?`)) return;
    const res = await fetch(`/api/order-types/${t.id}`, { method: "DELETE" });
    if (res.ok) {
      setTypes((prev) => prev.filter((x) => x.id !== t.id));
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Не удалось удалить тип");
    }
  }

  if (loading) return <div className="p-6 text-fg-subtle">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Layers size={18} />}
        title="Типы заявок"
        subtitle="Список типов, доступных при создании заявки"
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Добавить тип
          </Button>
        }
      />

      {types.length === 0 ? (
        <Card padding="md">
          <div className="py-12 text-center text-fg-subtle">
            <Layers size={36} className="mx-auto mb-2 opacity-30" />
            <p>Типов пока нет</p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-line-soft">
            {types.map((t) => (
              <div key={t.id} className="group flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-fg truncate">{t.label}</span>
                    {!t.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-hover text-fg-muted">
                        Скрыт
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-fg-subtle font-mono">{t.code}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(t)}
                    className="p-1.5 rounded hover:bg-surface-hover text-fg-muted"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-fg-muted hover:text-red-600"
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
        title={editing ? "Редактировать тип" : "Новый тип заявки"}
      >
        <div className="space-y-4">
          <Input
            label="Название *"
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            placeholder="Гравировка, Сублимация..."
          />

          <label className="flex items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="rounded border-line"
            />
            Доступен при создании заявки
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.label.trim()}>
              {editing ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
