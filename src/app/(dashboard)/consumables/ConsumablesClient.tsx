"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { CONSUMABLE_TYPE_LABELS } from "@/lib/constants";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Search, Package, AlertTriangle, ArrowDown, ArrowUp, RefreshCw, Pencil, Trash2, History } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Consumable {
  id: string;
  name: string;
  type: string;
  unit: string;
  stock: number;
  minStock: number;
  purchasePrice: number;
  writeoffPrice: number;
  article: string | null;
  supplier: { id: string; name: string } | null;
  isLow: boolean;
  _count: { movements: number };
}

interface Supplier {
  id: string;
  name: string;
}

interface Props {
  initialConsumables: Consumable[];
  suppliers: Supplier[];
}

interface Movement {
  id: string;
  direction: string;
  qty: number;
  note: string | null;
  totalCost: number | null;
  date: string;
  orderId: string | null;
}

const EMPTY_FORM = { name: "", type: "OTHER", unit: "шт", stock: "0", minStock: "0", purchasePrice: "0", writeoffPrice: "0", supplierId: "", article: "" };

export default function ConsumablesClient({ initialConsumables, suppliers }: Props) {
  const [consumables, setConsumables] = useState(initialConsumables);
  const [search, setSearch] = useState("");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [editingConsumable, setEditingConsumable] = useState<Consumable | null>(null);
  const [isMovementModalOpen, setMovementModalOpen] = useState(false);
  const [isHistoryModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<Movement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedConsumable, setSelectedConsumable] = useState<Consumable | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [movementForm, setMovementForm] = useState({
    direction: "IN",
    qty: "",
    note: "",
    totalCost: "",
  });

  const filtered = consumables.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchLow = !showLowOnly || c.isLow;
    return matchSearch && matchLow;
  });

  const lowCount = consumables.filter((c) => c.isLow).length;

  function openCreate() {
    setEditingConsumable(null);
    setForm(EMPTY_FORM);
    setCreateModalOpen(true);
  }

  function openEdit(c: Consumable) {
    setEditingConsumable(c);
    setForm({
      name: c.name, type: c.type, unit: c.unit,
      stock: String(c.stock), minStock: String(c.minStock),
      purchasePrice: String(c.purchasePrice), writeoffPrice: String(c.writeoffPrice),
      supplierId: c.supplier?.id || "", article: c.article || "",
    });
    setCreateModalOpen(true);
  }

  async function openHistory(c: Consumable) {
    setSelectedConsumable(c);
    setHistoryLoading(true);
    setHistoryModalOpen(true);
    const data = await fetch(`/api/consumables/movements?consumableId=${c.id}`).then((r) => r.json());
    setHistoryItems(Array.isArray(data) ? data : []);
    setHistoryLoading(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Удалить расходник «${name}»?`)) return;
    const res = await fetch(`/api/consumables/${id}`, { method: "DELETE" });
    if (res.ok) setConsumables((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const payload = {
      ...form,
      stock: Number(form.stock),
      minStock: Number(form.minStock),
      purchasePrice: Number(form.purchasePrice),
      writeoffPrice: Number(form.writeoffPrice),
      supplierId: form.supplierId || undefined,
    };

    if (editingConsumable) {
      const res = await fetch(`/api/consumables/${editingConsumable.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setConsumables((prev) => prev.map((c) => c.id === editingConsumable.id ? updated : c));
        setCreateModalOpen(false);
      }
      setLoading(false);
      return;
    }

    const res = await fetch("/api/consumables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const created = await res.json();
      const supplier = suppliers.find((s) => s.id === created.supplierId) || null;
      setConsumables((prev) => [
        { ...created, stock: Number(created.stock), minStock: Number(created.minStock),
          purchasePrice: Number(created.purchasePrice), writeoffPrice: Number(created.writeoffPrice),
          supplier, isLow: Number(created.stock) < Number(created.minStock), _count: { movements: 0 } },
        ...prev,
      ]);
      setCreateModalOpen(false);
    }
    setLoading(false);
  }


  async function handleMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConsumable) return;
    setLoading(true);
    const res = await fetch("/api/consumables/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consumableId: selectedConsumable.id,
        direction: movementForm.direction,
        qty: Number(movementForm.qty),
        note: movementForm.note || undefined,
        totalCost: movementForm.totalCost ? Number(movementForm.totalCost) : undefined,
      }),
    });
    if (res.ok) {
      const delta = movementForm.direction === "IN"
        ? Number(movementForm.qty)
        : movementForm.direction === "OUT"
        ? -Number(movementForm.qty)
        : Number(movementForm.qty);
      setConsumables((prev) =>
        prev.map((c) => {
          if (c.id !== selectedConsumable.id) return c;
          const newStock = c.stock + delta;
          return { ...c, stock: newStock, isLow: newStock < c.minStock };
        })
      );
      setMovementModalOpen(false);
      setMovementForm({ direction: "IN", qty: "", note: "", totalCost: "" });
    }
    setLoading(false);
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Расходники</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {consumables.length} позиций
            {lowCount > 0 && (
              <span className="ml-2 text-orange-600 font-medium">
                · {lowCount} заканчиваются
              </span>
            )}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Добавить расходник
        </Button>
      </div>

      {/* Alert */}
      {lowCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <AlertTriangle size={18} className="text-orange-500 flex-shrink-0" />
          <p className="text-sm text-orange-700">
            <span className="font-semibold">{lowCount} позиций</span> ниже минимального остатка — требуют пополнения
          </p>
          <button
            onClick={() => setShowLowOnly(!showLowOnly)}
            className="ml-auto text-xs text-orange-700 font-medium hover:underline"
          >
            {showLowOnly ? "Показать все" : "Только критичные"}
          </button>
        </div>
      )}

      {/* Filters */}
      <Card padding="sm">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск расходников..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Материал</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Тип</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Остаток</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Мин. остаток</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Цена закупки</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Поставщик</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  <Package size={32} className="mx-auto mb-2 opacity-30" />
                  Расходники не найдены
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className={`hover:bg-gray-50 ${c.isLow ? "bg-orange-50/40" : ""}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {c.isLow && <AlertTriangle size={14} className="text-orange-500 flex-shrink-0" />}
                      <div>
                        <p className="font-medium text-gray-800">{c.name}</p>
                        {c.article && <p className="text-xs text-gray-400">Арт: {c.article}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {CONSUMABLE_TYPE_LABELS[c.type as keyof typeof CONSUMABLE_TYPE_LABELS]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${c.isLow ? "text-orange-600" : "text-gray-800"}`}>
                      {c.stock} {c.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-sm">
                    {c.minStock} {c.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 text-sm">
                    {formatCurrency(c.purchasePrice)} / {c.unit}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {c.supplier?.name || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setSelectedConsumable(c); setMovementModalOpen(true); }}
                        className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                        title="Записать движение"
                      >
                        <RefreshCw size={13} />
                      </button>
                      <button
                        onClick={() => openHistory(c)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="История движений"
                      >
                        <History size={13} />
                      </button>
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                        title="Редактировать"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Удалить"
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
      <Modal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} title={editingConsumable ? "Редактировать расходник" : "Добавить расходник"} size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Название *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Тип"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={Object.entries(CONSUMABLE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
            <Input label="Единица измерения" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="м², пог.м, шт, л" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Текущий остаток" type="number" min={0} step={0.001} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            <Input label="Мин. остаток" type="number" min={0} step={0.001} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Цена закупки (сом)" type="number" min={0} value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
            <Input label="Цена списания (сом)" type="number" min={0} value={form.writeoffPrice} onChange={(e) => setForm({ ...form, writeoffPrice: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Поставщик"
              value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
              placeholder="Выберите поставщика"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
            <Input label="Артикул" value={form.article} onChange={(e) => setForm({ ...form, article: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setCreateModalOpen(false)}>Отмена</Button>
            <Button type="submit" loading={loading}>{editingConsumable ? "Сохранить" : "Добавить"}</Button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`История: ${selectedConsumable?.name}`}
        size="md"
      >
        <div className="space-y-2">
          {historyLoading ? (
            <p className="text-sm text-gray-400 text-center py-6">Загрузка...</p>
          ) : historyItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Движений нет</p>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {historyItems.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      m.direction === "IN" ? "bg-green-100" : m.direction === "OUT" ? "bg-red-100" : "bg-blue-100"
                    }`}>
                      {m.direction === "IN" ? (
                        <ArrowDown size={12} className="text-green-600" />
                      ) : m.direction === "OUT" ? (
                        <ArrowUp size={12} className="text-red-600" />
                      ) : (
                        <RefreshCw size={12} className="text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {m.direction === "IN" ? "+" : m.direction === "OUT" ? "−" : "±"}{m.qty} {selectedConsumable?.unit}
                      </p>
                      <p className="text-xs text-gray-400">{m.note || (m.orderId ? "Авто-списание по заявке" : "—")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{formatDate(m.date)}</p>
                    {m.totalCost && <p className="text-xs text-gray-400">{m.totalCost.toLocaleString("ru-RU")} сом</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Movement Modal */}
      <Modal
        isOpen={isMovementModalOpen}
        onClose={() => setMovementModalOpen(false)}
        title={`Движение: ${selectedConsumable?.name}`}
      >
        <form onSubmit={handleMovement} className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <span className="text-gray-500">Текущий остаток: </span>
            <span className="font-semibold text-gray-900">
              {selectedConsumable?.stock} {selectedConsumable?.unit}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "IN", label: "Приход", icon: <ArrowDown size={14} />, color: "bg-green-600" },
              { value: "OUT", label: "Расход", icon: <ArrowUp size={14} />, color: "bg-red-600" },
              { value: "ADJUSTMENT", label: "Корректировка", icon: <RefreshCw size={14} />, color: "bg-blue-600" },
            ].map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setMovementForm({ ...movementForm, direction: d.value })}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  movementForm.direction === d.value ? `${d.color} text-white` : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {d.icon} {d.label}
              </button>
            ))}
          </div>
          <Input
            label="Количество *"
            type="number"
            min={0.001}
            step={0.001}
            required
            value={movementForm.qty}
            onChange={(e) => setMovementForm({ ...movementForm, qty: e.target.value })}
          />
          <Input
            label="Сумма (сом)"
            type="number"
            min={0}
            value={movementForm.totalCost}
            onChange={(e) => setMovementForm({ ...movementForm, totalCost: e.target.value })}
          />
          <Input
            label="Примечание"
            value={movementForm.note}
            onChange={(e) => setMovementForm({ ...movementForm, note: e.target.value })}
            placeholder="Поставка от 15.04.2026..."
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setMovementModalOpen(false)}>Отмена</Button>
            <Button type="submit" loading={loading} disabled={!movementForm.qty}>Провести</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
