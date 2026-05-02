"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { AlertTriangle, Plus, Check, X, Trash2, ChevronDown } from "lucide-react";

interface Equipment {
  id: string;
  name: string;
  pricingUnit: string;
  costPerLm: number | null;
}

interface Order {
  id: string;
  number: string;
}

interface DefectRecord {
  id: string;
  qty: number;
  unit: string;
  reason: string | null;
  notes: string | null;
  cost: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  equipment: { id: string; name: string; pricingUnit: string };
  operator: { id: string; name: string };
  approvedBy: { id: string; name: string } | null;
  order: { id: string; number: string } | null;
}

const PRICING_UNIT_MEASURE: Record<string, string> = {
  LM: "пог.м", SQM: "м²", PCS: "шт", CUT: "мм",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "На проверке",
  APPROVED: "Подтверждён",
  REJECTED: "Отклонён",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
  APPROVED: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  REJECTED: "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400",
};

function formatCurrency(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " сом";
}

function formatDate(s: string) {
  return new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DefectsPage() {
  const [records, setRecords] = useState<DefectRecord[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);

  const [isModalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState({ equipmentId: "", orderId: "", qty: "", unit: "пог.м", reason: "", notes: "" });

  const [statusFilter, setStatusFilter] = useState("");
  const [operatorFilter, setOperatorFilter] = useState("");

  const isManager = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (operatorFilter) params.set("operatorId", operatorFilter);
    const res = await fetch(`/api/defects?${params}`);
    if (res.ok) setRecords(await res.json());
    setLoading(false);
  }, [statusFilter, operatorFilter]);

  useEffect(() => {
    Promise.all([
      fetch("/api/equipment").then((r) => r.json()),
      fetch("/api/orders?limit=100").then((r) => r.json()).then((d) => d?.data ?? d ?? []).catch(() => []),
      fetch("/api/auth/session").then((r) => r.json()).catch(() => null),
    ]).then(([eq, ord, session]) => {
      setEquipment(Array.isArray(eq) ? eq : []);
      setOrders(Array.isArray(ord) ? ord : []);
      if (session?.user) setCurrentUser({ id: session.user.id, role: session.user.role });
    });
    load();
  }, [load]);

  useEffect(() => { load(); }, [load]);

  const selectedEq = equipment.find((e) => e.id === form.equipmentId);
  const previewCost = selectedEq?.costPerLm && form.qty
    ? (selectedEq.costPerLm * Number(form.qty)).toFixed(2)
    : null;

  function openCreate() {
    setForm({ equipmentId: "", orderId: "", qty: "", unit: "пог.м", reason: "", notes: "" });
    setSaveError("");
    setModalOpen(true);
  }

  function handleEquipmentChange(equipmentId: string) {
    const eq = equipment.find((e) => e.id === equipmentId);
    setForm((f) => ({
      ...f,
      equipmentId,
      unit: eq ? (PRICING_UNIT_MEASURE[eq.pricingUnit] || "пог.м") : f.unit,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.equipmentId || !form.qty) return;
    setSaving(true);
    setSaveError("");
    const res = await fetch("/api/defects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipmentId: form.equipmentId,
        orderId: form.orderId || null,
        qty: Number(form.qty),
        unit: form.unit,
        reason: form.reason || null,
        notes: form.notes || null,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setRecords((prev) => [created, ...prev]);
      setModalOpen(false);
    } else {
      const err = await res.json().catch(() => ({}));
      setSaveError(err?.error ? JSON.stringify(err.error) : "Ошибка сохранения");
    }
    setSaving(false);
  }

  async function handleApprove(id: string, status: "APPROVED" | "REJECTED") {
    const res = await fetch(`/api/defects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRecords((prev) => prev.map((r) => r.id === id ? updated : r));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить запись о браке?")) return;
    const res = await fetch(`/api/defects/${id}`, { method: "DELETE" });
    if (res.ok) setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  const operators = Array.from(new Map(records.map((r) => [r.operator.id, r.operator])).values());

  const totalCost = records
    .filter((r) => r.status === "APPROVED")
    .reduce((sum, r) => sum + r.cost, 0);

  const pendingCount = records.filter((r) => r.status === "PENDING").length;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <AlertTriangle size={22} className="text-amber-500" /> Журнал брака
        </h1>
        <Button onClick={openCreate}>
          <Plus size={16} /> Добавить брак
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card padding="md">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Потери (подтверждённые)</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalCost)}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Всего записей</p>
          <p className="text-xl font-bold text-gray-800 dark:text-slate-200">{records.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Ожидают проверки</p>
          <p className="text-xl font-bold text-yellow-600">{pendingCount}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Все статусы</option>
          <option value="PENDING">На проверке</option>
          <option value="APPROVED">Подтверждён</option>
          <option value="REJECTED">Отклонён</option>
        </select>

        {isManager && operators.length > 0 && (
          <select
            value={operatorFilter}
            onChange={(e) => setOperatorFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Все операторы</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>{op.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Records table */}
      {loading ? (
        <div className="text-center py-10 text-gray-400 dark:text-slate-500">Загрузка...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">Записей нет</div>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400">Дата</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400">Оператор</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400">Оборудование</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400">Заявка</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400">Кол-во</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400">Стоимость</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400">Причина</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400">Статус</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/20">
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-200 whitespace-nowrap">{r.operator.name}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">{r.equipment.name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                      {r.order ? `#${r.order.number}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="font-medium text-gray-800 dark:text-slate-200">{r.qty}</span>{" "}
                      <span className="text-xs text-gray-400">{r.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {r.cost > 0
                        ? <span className="font-medium text-red-600">{formatCurrency(r.cost)}</span>
                        : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400 max-w-50 truncate" title={r.reason || ""}>
                      {r.reason || <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isManager && r.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => handleApprove(r.id, "APPROVED")}
                              title="Подтвердить"
                              className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => handleApprove(r.id, "REJECTED")}
                              title="Отклонить"
                              className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </>
                        )}
                        {(r.status === "PENDING") && (currentUser?.id === r.operator.id || isManager) && (
                          <button
                            onClick={() => handleDelete(r.id)}
                            title="Удалить"
                            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create modal */}
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Записать брак">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Оборудование *"
            value={form.equipmentId}
            onChange={(e) => handleEquipmentChange(e.target.value)}
            options={[
              { value: "", label: "— выберите оборудование —" },
              ...equipment.map((eq) => ({
                value: eq.id,
                label: eq.costPerLm
                  ? `${eq.name} (себест. ${eq.costPerLm} сом/${PRICING_UNIT_MEASURE[eq.pricingUnit] || "ед"})`
                  : eq.name,
              })),
            ]}
          />
          <Select
            label="Заявка (необязательно)"
            value={form.orderId}
            onChange={(e) => setForm({ ...form, orderId: e.target.value })}
            options={[
              { value: "", label: "— без заявки —" },
              ...orders.map((o) => ({ value: o.id, label: `#${o.number}` })),
            ]}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Количество брака *"
              type="number"
              min={0.001}
              step={0.001}
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              placeholder="1.5"
            />
            <Input
              label="Единица"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="пог.м"
            />
          </div>

          {previewCost && (
            <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm">
              <span className="text-gray-600 dark:text-slate-400">Стоимость потерь: </span>
              <span className="font-bold text-red-600">{formatCurrency(Number(previewCost))}</span>
            </div>
          )}

          <Input
            label="Причина брака"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Слезание, неправильный файл, пузыри..."
          />
          <Input
            label="Примечание"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Дополнительно"
          />

          {saveError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{saveError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button type="submit" loading={saving} disabled={!form.equipmentId || !form.qty}>Записать</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
