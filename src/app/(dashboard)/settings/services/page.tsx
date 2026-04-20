"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { ORDER_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { Plus, Wrench, Pencil, Trash2, Package, X } from "lucide-react";

interface ServiceConsumable {
  id: string;
  qtyPerUnit: number;
  consumable: { id: string; name: string; unit: string; writeoffPrice: string };
}

interface Service {
  id: string;
  name: string;
  type: string | null;
  unit: string;
  price: number;
  isActive: boolean;
  equipment: { id: string; name: string } | null;
}

interface Consumable {
  id: string;
  name: string;
  unit: string;
}

interface Equipment {
  id: string;
  name: string;
}

const EMPTY_FORM = { name: "", type: "", unit: "м²", price: "0", equipmentId: "", isActive: true };

export default function ServicesSettingsPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // ServiceConsumable panel
  const [scServiceId, setScServiceId] = useState<string | null>(null);
  const [scServiceName, setScServiceName] = useState("");
  const [scItems, setScItems] = useState<ServiceConsumable[]>([]);
  const [scLoading, setScLoading] = useState(false);
  const [newScConsumableId, setNewScConsumableId] = useState("");
  const [newScQty, setNewScQty] = useState("");
  const [scSaving, setScSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/equipment").then((r) => r.json()),
      fetch("/api/consumables").then((r) => r.json()),
    ]).then(([s, e, c]) => {
      setServices(Array.isArray(s) ? s : []);
      setEquipment(Array.isArray(e) ? e : []);
      setConsumables(Array.isArray(c) ? c : []);
      setLoading(false);
    });
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(s: Service) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      type: s.type || "",
      unit: s.unit,
      price: String(s.price),
      equipmentId: s.equipment?.id || "",
      isActive: s.isActive,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      price: Number(form.price),
      type: form.type || null,
      equipmentId: form.equipmentId || null,
    };

    if (editingId) {
      const res = await fetch(`/api/services/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setServices((prev) => prev.map((s) => s.id === editingId ? { ...updated, price: Number(updated.price) } : s));
        setModalOpen(false);
      }
    } else {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        const eq = equipment.find((e) => e.id === created.equipmentId) || null;
        setServices((prev) => [...prev, { ...created, price: Number(created.price), equipment: eq }]);
        setModalOpen(false);
      }
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Удалить услугу «${name}»?`)) return;
    const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
    if (res.ok) setServices((prev) => prev.filter((s) => s.id !== id));
  }

  async function openScPanel(serviceId: string, serviceName: string) {
    setScServiceId(serviceId);
    setScServiceName(serviceName);
    setScLoading(true);
    setNewScConsumableId("");
    setNewScQty("");
    const data = await fetch(`/api/services/${serviceId}/consumables`).then((r) => r.json());
    setScItems(Array.isArray(data) ? data : []);
    setScLoading(false);
  }

  async function handleAddSc(e: React.FormEvent) {
    e.preventDefault();
    if (!scServiceId || !newScConsumableId || !newScQty) return;
    setScSaving(true);
    const res = await fetch(`/api/services/${scServiceId}/consumables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consumableId: newScConsumableId, qtyPerUnit: Number(newScQty) }),
    });
    if (res.ok) {
      const item = await res.json();
      setScItems((prev) => {
        const exists = prev.find((i) => i.id === item.id);
        return exists ? prev.map((i) => i.id === item.id ? item : i) : [...prev, item];
      });
      setNewScConsumableId("");
      setNewScQty("");
    }
    setScSaving(false);
  }

  async function handleDeleteSc(scId: string) {
    if (!scServiceId) return;
    const res = await fetch(`/api/services/${scServiceId}/consumables?scId=${scId}`, { method: "DELETE" });
    if (res.ok) setScItems((prev) => prev.filter((i) => i.id !== scId));
  }

  if (loading) return <div className="p-6 text-gray-400">Загрузка...</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Wrench size={22} /> Справочник услуг
        </h1>
        <Button onClick={openCreate}>
          <Plus size={16} /> Добавить услугу
        </Button>
      </div>

      <Card padding="none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Услуга</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Тип</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ед. изм.</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Цена</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Оборудование</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {services.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Услуг нет</td></tr>
            ) : (
              services.map((s) => (
                <tr key={s.id} className={`hover:bg-gray-50 ${!s.isActive ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {s.type ? ORDER_TYPE_LABELS[s.type as keyof typeof ORDER_TYPE_LABELS] : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.unit}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">{formatCurrency(s.price)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{s.equipment?.name || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {s.isActive ? "Активна" : "Неактивна"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openScPanel(s.id, s.name)}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                        title="Расходники"
                      >
                        <Package size={13} />
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id, s.name)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Редактировать услугу" : "Добавить услугу"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Название *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Тип работы"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              placeholder="Выберите тип"
              options={Object.entries(ORDER_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
            <Input label="Единица измерения" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <Input label="Базовая цена (₽)" type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <Select
            label="Оборудование"
            value={form.equipmentId}
            onChange={(e) => setForm({ ...form, equipmentId: e.target.value })}
            placeholder="Не привязана"
            options={equipment.map((e) => ({ value: e.id, label: e.name }))}
          />
          {editingId && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive as boolean}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="accent-violet-600 w-4 h-4"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700 cursor-pointer">Активна</label>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button type="submit" loading={saving}>{editingId ? "Сохранить" : "Добавить"}</Button>
          </div>
        </form>
      </Modal>

      {/* ServiceConsumable panel */}
      <Modal
        isOpen={scServiceId !== null}
        onClose={() => setScServiceId(null)}
        title={`Расходники: ${scServiceName}`}
        size="md"
      >
        <div className="space-y-4">
          {scLoading ? (
            <p className="text-sm text-gray-400 text-center py-4">Загрузка...</p>
          ) : (
            <>
              {scItems.length > 0 ? (
                <div className="space-y-2">
                  {scItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.consumable.name}</p>
                        <p className="text-xs text-gray-500">
                          {item.qtyPerUnit} {item.consumable.unit} на ед. услуги
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteSc(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-2">Расходников не привязано</p>
              )}

              <form onSubmit={handleAddSc} className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Добавить расходник</p>
                <Select
                  label="Расходник"
                  value={newScConsumableId}
                  onChange={(e) => setNewScConsumableId(e.target.value)}
                  placeholder="Выберите расходник"
                  options={consumables
                    .filter((c) => !scItems.some((i) => i.consumable.id === c.id))
                    .map((c) => ({ value: c.id, label: c.name }))}
                />
                <Input
                  label="Норма расхода на 1 ед. услуги"
                  type="number"
                  min={0}
                  step={0.0001}
                  value={newScQty}
                  onChange={(e) => setNewScQty(e.target.value)}
                  placeholder="0.5"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    loading={scSaving}
                    disabled={!newScConsumableId || !newScQty}
                  >
                    <Plus size={14} /> Привязать
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
