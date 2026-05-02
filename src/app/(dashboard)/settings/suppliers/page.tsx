"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { Plus, Truck, Edit3, Trash2, Package } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  materials: string[];
  notes: string | null;
  _count: { consumables: number };
}

const emptyForm = { name: "", phone: "", email: "", materials: "", notes: "" };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((data) => { setSuppliers(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name,
      phone: s.phone || "",
      email: s.email || "",
      materials: s.materials.join(", "),
      notes: s.notes || "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      materials: form.materials.split(",").map((m) => m.trim()).filter(Boolean),
      notes: form.notes.trim() || null,
    };

    try {
      if (editing) {
        const res = await fetch(`/api/suppliers/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setSuppliers((prev) => prev.map((s) => s.id === editing.id ? { ...s, ...updated } : s));
        }
      } else {
        const res = await fetch("/api/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          setSuppliers((prev) => [...prev, { ...created, _count: { consumables: 0 } }]);
        }
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить поставщика?")) return;
    const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    if (res.ok) setSuppliers((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) return <div className="p-6 text-gray-400 dark:text-slate-500">Загрузка...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Поставщики</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Справочник поставщиков расходных материалов</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Добавить
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <Card padding="md">
          <div className="py-12 text-center text-gray-400 dark:text-slate-500">
            <Truck size={36} className="mx-auto mb-2 opacity-30" />
            <p>Поставщиков пока нет</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <Card key={s.id} padding="md">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-violet-100 dark:bg-violet-900/40 rounded-lg flex items-center justify-center shrink-0">
                    <Truck size={16} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{s.name}</p>
                    {s._count.consumables > 0 && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                        <Package size={10} /> {s._count.consumables} расходник(ов)
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-violet-600 rounded">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <dl className="space-y-1.5">
                {s.phone && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500 dark:text-slate-500">Телефон</dt>
                    <dd className="text-gray-800 dark:text-slate-200">{s.phone}</dd>
                  </div>
                )}
                {s.email && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500 dark:text-slate-500">Email</dt>
                    <dd className="text-gray-800 dark:text-slate-200 truncate max-w-[160px]">{s.email}</dd>
                  </div>
                )}
                {s.materials.length > 0 && (
                  <div className="pt-1">
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Поставляемые материалы:</p>
                    <div className="flex flex-wrap gap-1">
                      {s.materials.map((m) => (
                        <span key={m} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-full">{m}</span>
                      ))}
                    </div>
                  </div>
                )}
                {s.notes && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 pt-1 border-t border-gray-100 dark:border-slate-700">{s.notes}</p>
                )}
              </dl>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Редактировать поставщика" : "Новый поставщик"}
      >
        <div className="space-y-4">
          <Input
            label="Название *"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="ООО «ПолиграфМатериалы»"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Телефон"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+7 999 123-45-67"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="info@supplier.ru"
            />
          </div>
          <Input
            label="Поставляемые материалы"
            value={form.materials}
            onChange={(e) => setForm((p) => ({ ...p, materials: e.target.value }))}
            placeholder="DTF-плёнка, UV-чернила, Vinyl (через запятую)"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Заметки</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
              placeholder="Условия работы, контактное лицо и т.д."
            />
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
