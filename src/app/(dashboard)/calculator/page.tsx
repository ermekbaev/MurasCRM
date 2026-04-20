"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Calculator, ShoppingCart, Check, Plus, Trash2, FileText, Cpu } from "lucide-react";

const CALC_TYPES = ["DTF", "UV_DTF", "UV_FLATBED", "LASER_CUT", "PLOTTER_CUT", "HIGH_PRECISION"] as const;
type CalcType = typeof CALC_TYPES[number];

const TYPE_LABELS: Record<string, string> = {
  DTF: "DTF-печать", UV_DTF: "UV DTF", UV_FLATBED: "UV планшет",
  LASER_CUT: "Лазерная резка", PLOTTER_CUT: "Плоттерная резка",
  HIGH_PRECISION: "Высокоточная печать", OTHER: "Не настроено",
};

const TYPE_COLORS: Record<string, string> = {
  DTF: "bg-blue-100 text-blue-700",
  UV_DTF: "bg-purple-100 text-purple-700",
  UV_FLATBED: "bg-indigo-100 text-indigo-700",
  LASER_CUT: "bg-red-100 text-red-700",
  PLOTTER_CUT: "bg-orange-100 text-orange-700",
  HIGH_PRECISION: "bg-teal-100 text-teal-700",
};

interface EquipmentItem {
  id: string;
  name: string;
  type: string;
  workWidth: number | null;
  pricePerLm: number | null;
  status: string;
}

interface CalcResult {
  subtotal: number;
  costTotal: number | null;
  margin: number | null;
  breakdown: { label: string; value: number }[];
  pricePerUnit: number | null;
  area: number | null;
}

export default function CalculatorPage() {
  const [type, setType] = useState<string>("");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [selectedEquipmentName, setSelectedEquipmentName] = useState("");
  const [params, setParams] = useState({
    width: "",
    height: "",
    cutLength: "",
    pricePerUnit: "",
    costPricePerUnit: "",
    urgency: false,
    urgencyPercent: "30",
  });
  const [discountTiers, setDiscountTiers] = useState<{ minQty: string; discountPct: string }[]>([]);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [orders, setOrders] = useState<{ id: string; number: string; client: { name: string } }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [invoiceClientId, setInvoiceClientId] = useState("");
  const [invoiceItemName, setInvoiceItemName] = useState("");
  const [itemName, setItemName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [savedInvoiceOk, setSavedInvoiceOk] = useState(false);

  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/orders?status=active&limit=50").then((r) => r.json()),
      fetch("/api/clients?limit=100").then((r) => r.json()),
      fetch("/api/equipment").then((r) => r.json()),
    ]).then(([ordersData, clientsData, equipmentData]) => {
      setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
      setClients(Array.isArray(clientsData.clients) ? clientsData.clients : []);
      if (Array.isArray(equipmentData)) {
        setEquipment(equipmentData.filter((e: EquipmentItem) => e.status === "ACTIVE"));
      }
    });
  }, []);

  const isCutType = type === "LASER_CUT" || type === "PLOTTER_CUT";
  const isAreaType = type && !isCutType;

  function selectEquipment(eq: EquipmentItem) {
    setSelectedEquipmentId(eq.id);
    setSelectedEquipmentName(eq.name);
    // Use equipment type if it's a known calc type, otherwise default to DTF
    const calcType = CALC_TYPES.includes(eq.type as CalcType) ? eq.type : "DTF";
    setType(calcType);
    setResult(null);
    setParams((p) => ({
      ...p,
      width: eq.workWidth ? String(eq.workWidth) : p.width,
      pricePerUnit: eq.pricePerLm ? String(eq.pricePerLm) : p.pricePerUnit,
    }));
  }

  function updateParam(key: string, value: string | boolean) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  async function calculate() {
    if (!type) return;
    setLoading(true);
    const body: Record<string, unknown> = {
      type,
      pricePerUnit: Number(params.pricePerUnit) || 0,
      urgency: params.urgency,
      urgencyPercent: Number(params.urgencyPercent) || 30,
    };
    if (params.costPricePerUnit) body.costPricePerUnit = Number(params.costPricePerUnit);
    if (isAreaType) {
      body.width = Number(params.width) || 0;
      body.height = Number(params.height) || 0;
    } else {
      body.cutLength = Number(params.cutLength) || 0;
    }
    if (discountTiers.length > 0) {
      body.discountQty = discountTiers
        .filter((t) => t.minQty && t.discountPct)
        .map((t) => ({ minQty: Number(t.minQty), discountPct: Number(t.discountPct) }));
    }
    const res = await fetch("/api/calculator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) setResult(await res.json());
    setLoading(false);
  }

  async function handleSaveToOrder() {
    if (!result || !selectedOrderId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrderId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: itemName || selectedEquipmentName || TYPE_LABELS[type] || type,
          qty: 1, unit: "шт", price: result.subtotal, discount: 0, total: result.subtotal,
        }),
      });
      if (res.ok) {
        setSavedOk(true);
        setTimeout(() => { setSavedOk(false); setSaveModalOpen(false); }, 1500);
      }
    } finally { setSaving(false); }
  }

  async function handleSaveToInvoice() {
    if (!result || !invoiceClientId) return;
    setSavingInvoice(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: invoiceClientId, vatRate: 0,
          items: [{ name: invoiceItemName || selectedEquipmentName || TYPE_LABELS[type] || type, qty: 1, unit: "шт", price: result.subtotal }],
        }),
      });
      if (res.ok) {
        setSavedInvoiceOk(true);
        setTimeout(() => { setSavedInvoiceOk(false); setInvoiceModalOpen(false); setInvoiceClientId(""); setInvoiceItemName(""); }, 1500);
      }
    } finally { setSavingInvoice(false); }
  }

  // Group equipment by type for display; unknown types go under "OTHER"
  const equipmentByType = equipment.reduce<Record<string, EquipmentItem[]>>((acc, eq) => {
    const key = CALC_TYPES.includes(eq.type as CalcType) ? eq.type : "OTHER";
    if (!acc[key]) acc[key] = [];
    acc[key].push(eq);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calculator size={24} className="text-violet-600" />
          Калькулятор стоимости
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Выберите станок — параметры подставятся автоматически</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input panel */}
        <div className="space-y-4">

          {/* Equipment selector */}
          <Card padding="md">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Cpu size={16} className="text-violet-500" /> Станок
            </h2>
            {equipment.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-400 mb-1">Оборудование не настроено.</p>
                <a href="/settings/equipment" className="text-sm text-violet-600 hover:underline">
                  Добавить оборудование →
                </a>
              </div>
            ) : (
              <>
                <select
                  value={selectedEquipmentId}
                  onChange={(e) => {
                    const eq = equipment.find((eq) => eq.id === e.target.value);
                    if (eq) selectEquipment(eq);
                    else { setSelectedEquipmentId(""); setType(""); setResult(null); }
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">— выберите станок —</option>
                  {Object.entries(equipmentByType).map(([t, items]) => (
                    <optgroup key={t} label={TYPE_LABELS[t] || t}>
                      {items.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.name}{eq.workWidth ? ` (${eq.workWidth} м)` : ""}{eq.pricePerLm ? ` · ${eq.pricePerLm} сом/пог.м` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {selectedEquipmentId && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[type] || "bg-gray-100 text-gray-600"}`}>
                      {TYPE_LABELS[type] || type}
                    </span>
                    {params.width && <span className="text-xs text-gray-500">ширина: {params.width} м</span>}
                    {params.pricePerUnit && <span className="text-xs text-gray-500">цена: {params.pricePerUnit} сом/пог.м</span>}
                    {!CALC_TYPES.includes(type as CalcType) && (
                      <span className="text-xs text-orange-500">
                        Тип не задан —{" "}
                        <a href="/settings/equipment" className="underline">настроить →</a>
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Parameters — shown only after equipment selected */}
          {type && (
            <Card padding="md">
              <h2 className="font-semibold text-gray-800 mb-4">Параметры</h2>
              <div className="space-y-4">

                {/* Area-based: width + length + qty */}
                {isAreaType && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Ширина рулона (м)"
                        type="number"
                        min={0}
                        step={0.001}
                        value={params.width}
                        onChange={(e) => updateParam("width", e.target.value)}
                        placeholder="1.00"
                      />
                      <Input
                        label="Длина (м)"
                        type="number"
                        min={0}
                        step={0.01}
                        value={params.height}
                        onChange={(e) => updateParam("height", e.target.value)}
                        placeholder="0.50"
                      />
                    </div>
                  </>
                )}

                {/* Cut-based */}
                {isCutType && (
                  <Input
                    label={type === "LASER_CUT" ? "Длина реза (мм)" : "Погонные метры"}
                    type="number"
                    min={0}
                    value={params.cutLength}
                    onChange={(e) => updateParam("cutLength", e.target.value)}
                    placeholder={type === "LASER_CUT" ? "1000" : "5"}
                  />
                )}

                {/* Price */}
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={isCutType ? "Цена (сом/мм или пог.м)" : "Цена за пог.м (сом)"}
                    type="number"
                    min={0}
                    value={params.pricePerUnit}
                    onChange={(e) => updateParam("pricePerUnit", e.target.value)}
                  />
                  <Input
                    label="Себестоимость"
                    type="number"
                    min={0}
                    value={params.costPricePerUnit}
                    onChange={(e) => updateParam("costPricePerUnit", e.target.value)}
                    placeholder="Не обязательно"
                  />
                </div>


                {/* Quantity discounts */}
                {isAreaType && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700">Скидки за тираж</p>
                      <button
                        type="button"
                        onClick={() => setDiscountTiers((prev) => [...prev, { minQty: "", discountPct: "" }])}
                        className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1"
                      >
                        <Plus size={12} /> Добавить
                      </button>
                    </div>
                    {discountTiers.length > 0 && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-gray-500 mb-1">
                          <span>От (шт)</span><span>Скидка (%)</span><span />
                        </div>
                        {discountTiers.map((tier, idx) => (
                          <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                            <input type="number" min={1} value={tier.minQty}
                              onChange={(e) => setDiscountTiers((prev) => prev.map((t, i) => i === idx ? { ...t, minQty: e.target.value } : t))}
                              placeholder="100" className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
                            <input type="number" min={0} max={100} value={tier.discountPct}
                              onChange={(e) => setDiscountTiers((prev) => prev.map((t, i) => i === idx ? { ...t, discountPct: e.target.value } : t))}
                              placeholder="5" className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
                            <button type="button" onClick={() => setDiscountTiers((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Urgency */}
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                  <input type="checkbox" id="urgency" checked={params.urgency as boolean}
                    onChange={(e) => updateParam("urgency", e.target.checked)} className="accent-orange-600 w-4 h-4" />
                  <label htmlFor="urgency" className="text-sm text-gray-700 cursor-pointer flex-1">Срочность</label>
                  {params.urgency && (
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} max={100} value={params.urgencyPercent}
                        onChange={(e) => updateParam("urgencyPercent", e.target.value)}
                        className="w-16 px-2 py-1 text-xs border border-gray-300 rounded" />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  )}
                </div>

                <Button onClick={calculate} loading={loading} className="w-full">
                  <Calculator size={16} /> Рассчитать
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Result panel */}
        <div>
          {result ? (
            <Card padding="md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800">Результат расчёта</h2>
                {type && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[type] || "bg-gray-100 text-gray-600"}`}>
                    {selectedEquipmentName || TYPE_LABELS[type]}
                  </span>
                )}
              </div>

              {result.area !== null && (
                <div className="p-3 bg-gray-50 rounded-lg mb-4 flex gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Длина</p>
                    <p className="text-base font-bold text-gray-900">{Number(params.height).toFixed(2)} пог.м</p>
                  </div>
                  <div className="border-l border-gray-200 pl-4">
                    <p className="text-xs text-gray-500">Площадь</p>
                    <p className="text-base font-bold text-gray-900">{result.area.toFixed(4)} м²</p>
                  </div>
                  <div className="border-l border-gray-200 pl-4">
                    <p className="text-xs text-gray-500">Ширина</p>
                    <p className="text-base font-bold text-gray-900">{params.width} м</p>
                  </div>
                </div>
              )}

              <div className="space-y-2 mb-4">
                {result.breakdown.map((item, idx) => (
                  <div key={idx} className={`flex items-center justify-between py-2 border-b border-gray-100 ${item.value < 0 ? "text-green-700" : ""}`}>
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <span className="text-sm font-medium">{formatCurrency(Math.abs(item.value))}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-violet-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-gray-900">ИТОГО</span>
                  <span className="text-2xl font-bold text-violet-700">{formatCurrency(result.subtotal)}</span>
                </div>
                {result.pricePerUnit && (
                  <p className="text-xs text-gray-500 mt-1 text-right">{formatCurrency(result.pricePerUnit)} за штуку</p>
                )}
              </div>

              {result.costTotal !== null && result.margin !== null && (
                <div className="p-4 bg-gray-50 rounded-xl space-y-2 mt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Себестоимость</span>
                    <span className="font-medium text-gray-800">{formatCurrency(result.costTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Прибыль</span>
                    <span className="font-medium text-green-700">{formatCurrency(result.subtotal - result.costTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Маржа</span>
                    <span className={`text-lg font-bold ${result.margin >= 30 ? "text-green-600" : result.margin >= 15 ? "text-yellow-600" : "text-red-600"}`}>
                      {result.margin.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${result.margin >= 30 ? "bg-green-500" : result.margin >= 15 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(result.margin, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="flex-1"
                  onClick={() => navigator.clipboard.writeText(formatCurrency(result.subtotal))}>
                  Скопировать
                </Button>
                <Button variant="outline" className="flex-1"
                  onClick={() => { setInvoiceItemName(selectedEquipmentName || TYPE_LABELS[type] || type); setInvoiceModalOpen(true); }}>
                  <FileText size={15} /> В счёт
                </Button>
                <Button className="flex-1"
                  onClick={() => { setItemName(selectedEquipmentName || TYPE_LABELS[type] || type); setSaveModalOpen(true); }}>
                  <ShoppingCart size={15} /> В заявку
                </Button>
              </div>
            </Card>
          ) : (
            <Card padding="md" className="flex flex-col items-center justify-center h-64 text-center">
              <Calculator size={48} className="text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm">
                {type ? "Введите параметры и нажмите «Рассчитать»" : "Выберите станок слева"}
              </p>
            </Card>
          )}
        </div>
      </div>

      <Modal isOpen={invoiceModalOpen} onClose={() => setInvoiceModalOpen(false)} title="Создать счёт из расчёта">
        <div className="space-y-4">
          <div className="p-3 bg-violet-50 rounded-lg">
            <p className="text-sm text-gray-600">Сумма:</p>
            <p className="text-xl font-bold text-violet-700">{result ? formatCurrency(result.subtotal) : "—"}</p>
          </div>
          <Input label="Название позиции" value={invoiceItemName} onChange={(e) => setInvoiceItemName(e.target.value)} placeholder="DTF-печать и т.д." />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Клиент *</label>
            <select value={invoiceClientId} onChange={(e) => setInvoiceClientId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">— выберите клиента —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setInvoiceModalOpen(false)}>Отмена</Button>
            <Button onClick={handleSaveToInvoice} loading={savingInvoice} disabled={!invoiceClientId}>
              {savedInvoiceOk ? <><Check size={14} /> Создан</> : "Создать счёт"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={saveModalOpen} onClose={() => setSaveModalOpen(false)} title="Добавить позицию в заявку">
        <div className="space-y-4">
          <div className="p-3 bg-violet-50 rounded-lg">
            <p className="text-sm text-gray-600">Сумма позиции:</p>
            <p className="text-xl font-bold text-violet-700">{result ? formatCurrency(result.subtotal) : "—"}</p>
          </div>
          <Input label="Название позиции" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="DTF-печать, визитки и т.д." />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Заявка</label>
            <select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">— выберите заявку —</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.number} — {o.client.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSaveModalOpen(false)}>Отмена</Button>
            <Button onClick={handleSaveToOrder} loading={saving} disabled={!selectedOrderId || !itemName.trim()}>
              {savedOk ? <><Check size={14} /> Добавлено</> : "Добавить в заявку"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
