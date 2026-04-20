"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { EQUIPMENT_STATUS_LABELS } from "@/lib/constants";
import { Plus, Cpu, Pencil, Trash2 } from "lucide-react";

interface Equipment {
  id: string;
  name: string;
  type: string;
  workWidth: number | null;
  pricePerLm: number | null;
  materials: string[];
  status: string;
  _count: { services: number };
}

const EMPTY_FORM = { name: "", type: "DTF", workWidth: "", pricePerLm: "", materials: "", status: "ACTIVE" };

const TYPE_LABELS: Record<string, string> = {
  DTF: "DTF-печать", UV_DTF: "UV DTF", UV_FLATBED: "UV планшет",
  LASER_CUT: "Лазерная резка", PLOTTER_CUT: "Плоттерная резка",
  HIGH_PRECISION: "Высокоточная печать", OTHER: "Другое",
};

export default function EquipmentSettingsPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    fetch("/api/equipment")
      .then((r) => r.json())
      .then((data) => { setEquipment(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaveError("");
    setModalOpen(true);
  }

  function openEdit(eq: Equipment) {
    setEditingId(eq.id);
    setSaveError("");
    setForm({
      name: eq.name,
      type: eq.type,
      workWidth: eq.workWidth?.toString() || "",
      pricePerLm: eq.pricePerLm?.toString() || "",
      materials: eq.materials.join(", "),
      status: eq.status,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    const payload = {
      ...form,
      workWidth: form.workWidth ? Number(form.workWidth) : null,
      pricePerLm: form.pricePerLm ? Number(form.pricePerLm) : null,
      materials: form.materials.split(",").map((m) => m.trim()).filter(Boolean),
    };

    if (editingId) {
      const res = await fetch(`/api/equipment/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setEquipment((prev) => prev.map((eq) => eq.id === editingId ? { ...updated, _count: eq._count } : eq));
        setModalOpen(false);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(err?.error ? JSON.stringify(err.error) : "Ошибка сохранения");
      }
    } else {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setEquipment((prev) => [...prev, { ...created, _count: { services: 0 } }]);
        setModalOpen(false);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(err?.error ? JSON.stringify(err.error) : "Ошибка сохранения");
      }
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Удалить оборудование «${name}»?`)) return;
    const res = await fetch(`/api/equipment/${id}`, { method: "DELETE" });
    if (res.ok) setEquipment((prev) => prev.filter((eq) => eq.id !== id));
  }

  if (loading) return <div className="p-6 text-gray-400">Загрузка...</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Cpu size={22} /> Оборудование
        </h1>
        <Button onClick={openCreate}>
          <Plus size={16} /> Добавить
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {equipment.length === 0 ? (
          <p className="text-gray-400 text-sm col-span-3 text-center py-8">Оборудования нет</p>
        ) : (
          equipment.map((eq) => (
            <Card key={eq.id} padding="md">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
                    <Cpu size={16} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{eq.name}</p>
                    <p className="text-xs text-gray-400">{TYPE_LABELS[eq.type] || eq.type}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${eq.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                  {EQUIPMENT_STATUS_LABELS[eq.status as keyof typeof EQUIPMENT_STATUS_LABELS]}
                </span>
              </div>
              {(eq.workWidth || eq.pricePerLm) && (
                <div className="flex gap-3 mt-2">
                  {eq.workWidth && (
                    <p className="text-xs text-gray-500">Ширина: <span className="font-medium text-gray-700">{eq.workWidth} м</span></p>
                  )}
                  {eq.pricePerLm && (
                    <p className="text-xs text-gray-500">Цена: <span className="font-medium text-violet-700">{eq.pricePerLm} сом/пог.м</span></p>
                  )}
                </div>
              )}
              {eq.materials.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {eq.materials.map((m) => (
                    <span key={m} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{m}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">{eq._count.services} услуг(и)</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(eq)}
                    className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(eq.id, eq.name)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Редактировать оборудование" : "Добавить оборудование"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Название *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select
            label="Вид работы *"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={[
              { value: "DTF", label: "DTF-печать" },
              { value: "UV_DTF", label: "UV DTF" },
              { value: "UV_FLATBED", label: "UV планшет" },
              { value: "LASER_CUT", label: "Лазерная резка" },
              { value: "PLOTTER_CUT", label: "Плоттерная резка" },
              { value: "HIGH_PRECISION", label: "Высокоточная печать" },
              { value: "OTHER", label: "Другое" },
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Рабочая ширина (м)"
              type="number"
              min={0}
              step={0.001}
              value={form.workWidth}
              onChange={(e) => setForm({ ...form, workWidth: e.target.value })}
              placeholder="1.00"
            />
            <Input
              label="Цена за пог.м (сом)"
              type="number"
              min={0}
              step={0.01}
              value={form.pricePerLm}
              onChange={(e) => setForm({ ...form, pricePerLm: e.target.value })}
              placeholder="1500"
            />
          </div>
          <Select
            label="Статус"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[{ value: "ACTIVE", label: "Работает" }, { value: "MAINTENANCE", label: "На обслуживании" }]}
          />
          <Input
            label="Материалы (через запятую)"
            value={form.materials}
            onChange={(e) => setForm({ ...form, materials: e.target.value })}
            placeholder="Акрил, ПВХ, Дерево"
          />
          {saveError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button type="submit" loading={saving}>{editingId ? "Сохранить" : "Добавить"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
