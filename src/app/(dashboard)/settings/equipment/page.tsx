"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { EQUIPMENT_STATUS_LABELS } from "@/lib/constants";
import { Plus, Cpu, Pencil, Trash2, Package, X, ToggleLeft, ToggleRight } from "lucide-react";

interface Equipment {
  id: string;
  name: string;
  type: string;
  workWidth: number | null;
  pricePerLm: number | null;
  pricingUnit: string;
  wastePerJob: number | null;
  materials: string[];
  status: string;
  _count: { orderItems: number };
}

interface Consumable {
  id: string;
  name: string;
  unit: string;
  stock: number;
}

interface EquipmentConsumable {
  id: string;
  consumableId: string;
  consumptionPerUnit: number;
  wastePerJob: number;
  autoDeduct: boolean;
  trigger: string;
  consumable: Consumable;
}

const PRICING_UNIT_LABELS: Record<string, string> = {
  LM: "Погонный метр (пог.м)",
  SQM: "Квадратный метр (м²)",
  PCS: "Штука (шт)",
  CUT: "Длина реза (мм/пог.м)",
};

const PRICING_UNIT_SHORT: Record<string, string> = {
  LM: "сом/пог.м",
  SQM: "сом/м²",
  PCS: "сом/шт",
  CUT: "сом/мм",
};

const PRICING_UNIT_MEASURE: Record<string, string> = {
  LM: "пог.м",
  SQM: "м²",
  PCS: "шт",
  CUT: "мм",
};

const TRIGGER_LABELS: Record<string, string> = {
  MANUAL: "Только вручную",
  ON_IN_PROGRESS: "При «В работе»",
  ON_READY: "При «Готово»",
};

const EMPTY_FORM = { name: "", type: "DTF", workWidth: "", pricePerLm: "", pricingUnit: "LM", wastePerJob: "", materials: "", status: "ACTIVE" };
const EMPTY_CONS_FORM = { consumableId: "", consumptionPerUnit: "1", autoDeduct: true, trigger: "ON_IN_PROGRESS" };

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

  // Consumables panel
  const [consEquipment, setConsEquipment] = useState<Equipment | null>(null);
  const [consConfigs, setConsConfigs] = useState<EquipmentConsumable[]>([]);
  const [allConsumables, setAllConsumables] = useState<Consumable[]>([]);
  const [consLoading, setConsLoading] = useState(false);
  const [consForm, setConsForm] = useState(EMPTY_CONS_FORM);
  const [consAdding, setConsAdding] = useState(false);
  const [showConsForm, setShowConsForm] = useState(false);

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
      pricingUnit: eq.pricingUnit || "LM",
      wastePerJob: eq.wastePerJob?.toString() || "",
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
      wastePerJob: form.wastePerJob ? Number(form.wastePerJob) : null,
      materials: form.materials.split(",").map((m) => m.trim()).filter(Boolean),
    };
    const hasWidth = form.pricingUnit === "LM" || form.pricingUnit === "SQM";
    if (!hasWidth) payload.workWidth = null;

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
        setEquipment((prev) => [...prev, { ...created, _count: { orderItems: 0 } }]);
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

  async function openConsumables(eq: Equipment) {
    setConsEquipment(eq);
    setConsLoading(true);
    setShowConsForm(false);
    setConsForm(EMPTY_CONS_FORM);

    const [cfgRes, allRes] = await Promise.all([
      fetch(`/api/equipment/${eq.id}/consumables`),
      fetch("/api/consumables"),
    ]);
    const [cfgData, allData] = await Promise.all([cfgRes.json(), allRes.json()]);
    setConsConfigs(Array.isArray(cfgData) ? cfgData : []);
    setAllConsumables(Array.isArray(allData) ? allData : []);
    setConsLoading(false);
  }

  async function handleAddConsumable(e: React.FormEvent) {
    e.preventDefault();
    if (!consEquipment || !consForm.consumableId) return;
    setConsAdding(true);
    const res = await fetch(`/api/equipment/${consEquipment.id}/consumables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consumableId: consForm.consumableId,
        consumptionPerUnit: Number(consForm.consumptionPerUnit),
        autoDeduct: consForm.autoDeduct,
        trigger: consForm.trigger,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setConsConfigs((prev) => {
        const exists = prev.find((c) => c.consumableId === created.consumableId);
        if (exists) return prev.map((c) => c.consumableId === created.consumableId ? created : c);
        return [...prev, created];
      });
      setShowConsForm(false);
      setConsForm(EMPTY_CONS_FORM);
    }
    setConsAdding(false);
  }

  async function handleRemoveConsumable(consumableId: string) {
    if (!consEquipment) return;
    const res = await fetch(`/api/equipment/${consEquipment.id}/consumables`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consumableId }),
    });
    if (res.ok) setConsConfigs((prev) => prev.filter((c) => c.consumableId !== consumableId));
  }

  async function toggleAutoDeduct(cfg: EquipmentConsumable) {
    if (!consEquipment) return;
    const res = await fetch(`/api/equipment/${consEquipment.id}/consumables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consumableId: cfg.consumableId,
        consumptionPerUnit: cfg.consumptionPerUnit,
        autoDeduct: !cfg.autoDeduct,
        trigger: cfg.trigger,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setConsConfigs((prev) => prev.map((c) => c.consumableId === cfg.consumableId ? updated : c));
    }
  }

  const availableConsumables = allConsumables.filter(
    (c) => !consConfigs.find((cfg) => cfg.consumableId === c.id)
  );

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
              {(eq.workWidth || eq.pricePerLm || eq.wastePerJob) && (
                <div className="flex gap-3 mt-2 flex-wrap">
                  {eq.workWidth && (
                    <p className="text-xs text-gray-500">Ширина: <span className="font-medium text-gray-700">{eq.workWidth} м</span></p>
                  )}
                  {eq.pricePerLm && (
                    <p className="text-xs text-gray-500">Цена: <span className="font-medium text-violet-700">{eq.pricePerLm} {PRICING_UNIT_SHORT[eq.pricingUnit] || "сом/ед"}</span></p>
                  )}
                  {eq.wastePerJob && (
                    <p className="text-xs text-gray-500">Отход: <span className="font-medium text-amber-600">{eq.wastePerJob} м/прогон</span></p>
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
                <p className="text-xs text-gray-400">{eq._count.orderItems} позиц(ий)</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => openConsumables(eq)}
                    title="Расходники"
                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                  >
                    <Package size={13} />
                  </button>
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

      {/* Equipment create/edit modal */}
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
          <Select
            label="Единица расчёта *"
            value={form.pricingUnit}
            onChange={(e) => setForm({ ...form, pricingUnit: e.target.value })}
            options={[
              { value: "LM", label: "Погонный метр (пог.м)" },
              { value: "SQM", label: "Квадратный метр (м²)" },
              { value: "PCS", label: "Штука (шт)" },
              { value: "CUT", label: "Длина реза (мм/пог.м)" },
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            {(form.pricingUnit === "LM" || form.pricingUnit === "SQM") && (
              <Input
                label="Рабочая ширина (м)"
                type="number"
                min={0}
                step={0.001}
                value={form.workWidth}
                onChange={(e) => setForm({ ...form, workWidth: e.target.value })}
                placeholder="1.00"
              />
            )}
            <Input
              label={`Цена за ${PRICING_UNIT_SHORT[form.pricingUnit] || "ед"}`}
              type="number"
              min={0}
              step={0.01}
              value={form.pricePerLm}
              onChange={(e) => setForm({ ...form, pricePerLm: e.target.value })}
              placeholder="1500"
            />
          </div>
          <Input
            label="Отход на прогон (м) — необязательно"
            type="number"
            min={0}
            step={0.01}
            value={form.wastePerJob}
            onChange={(e) => setForm({ ...form, wastePerJob: e.target.value })}
            placeholder="0.50"
          />
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

      {/* Consumables panel modal */}
      <Modal
        isOpen={!!consEquipment}
        onClose={() => setConsEquipment(null)}
        title={`Расходники — ${consEquipment?.name}`}
      >
        {consLoading ? (
          <div className="py-6 text-center text-gray-400 text-sm">Загрузка...</div>
        ) : (
          <div className="space-y-3">
            {consConfigs.length === 0 && !showConsForm && (
              <p className="text-sm text-gray-400 text-center py-4">
                Расходники не привязаны. Нажмите «+» чтобы добавить.
              </p>
            )}

            {consConfigs.map((cfg) => (
              <div key={cfg.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{cfg.consumable.name}</p>
                  <p className="text-xs text-gray-500">
                    {cfg.consumptionPerUnit} {cfg.consumable.unit}/{PRICING_UNIT_MEASURE[consEquipment?.pricingUnit || "LM"] || "ед"}
                  </p>
                  <p className="text-xs text-gray-400">{TRIGGER_LABELS[cfg.trigger]}</p>
                </div>
                <button
                  onClick={() => toggleAutoDeduct(cfg)}
                  title={cfg.autoDeduct ? "Авто-списание включено" : "Авто-списание выключено"}
                  className="shrink-0"
                >
                  {cfg.autoDeduct
                    ? <ToggleRight size={22} className="text-emerald-500" />
                    : <ToggleLeft size={22} className="text-gray-300" />}
                </button>
                <button
                  onClick={() => handleRemoveConsumable(cfg.consumableId)}
                  className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {showConsForm ? (
              <form onSubmit={handleAddConsumable} className="space-y-3 pt-2 border-t border-gray-100">
                <Select
                  label="Расходник *"
                  value={consForm.consumableId}
                  onChange={(e) => setConsForm({ ...consForm, consumableId: e.target.value })}
                  options={[
                    { value: "", label: "— выберите —" },
                    ...availableConsumables.map((c) => ({ value: c.id, label: `${c.name} (${c.unit})` })),
                  ]}
                />
                <Input
                  label={`Расход на 1 ${PRICING_UNIT_MEASURE[consEquipment?.pricingUnit || "LM"] || "ед"}`}
                  type="number"
                  min={0}
                  step={0.0001}
                  value={consForm.consumptionPerUnit}
                  onChange={(e) => setConsForm({ ...consForm, consumptionPerUnit: e.target.value })}
                  placeholder="1.0"
                />
                <Select
                  label="Момент списания"
                  value={consForm.trigger}
                  onChange={(e) => setConsForm({ ...consForm, trigger: e.target.value })}
                  options={[
                    { value: "ON_IN_PROGRESS", label: "При «В работе»" },
                    { value: "ON_READY", label: "При «Готово»" },
                    { value: "MANUAL", label: "Только вручную" },
                  ]}
                />
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consForm.autoDeduct}
                    onChange={(e) => setConsForm({ ...consForm, autoDeduct: e.target.checked })}
                    className="rounded"
                  />
                  Авто-списание включено
                </label>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" type="button" size="sm" onClick={() => setShowConsForm(false)}>Отмена</Button>
                  <Button type="submit" size="sm" loading={consAdding} disabled={!consForm.consumableId}>Добавить</Button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowConsForm(true)}
                className="w-full flex items-center justify-center gap-1 py-2 text-sm text-violet-600 hover:bg-violet-50 rounded-lg border border-dashed border-violet-200 transition-colors"
              >
                <Plus size={14} /> Привязать расходник
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
