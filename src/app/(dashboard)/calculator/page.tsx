"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import { ORDER_TYPE_LABELS } from "@/lib/constants";
import { Calculator, ShoppingCart, Check, Plus, Trash2, FileText } from "lucide-react";

const WORK_TYPES = ["DTF", "UV_DTF", "UV_FLATBED", "LASER_CUT", "PLOTTER_CUT", "HIGH_PRECISION"] as const;

interface CalcResult {
  subtotal: number;
  costTotal: number | null;
  margin: number | null;
  breakdown: { label: string; value: number }[];
  pricePerUnit: number | null;
  area: number | null;
}

export default function CalculatorPage() {
  const [type, setType] = useState<string>("DTF");
  const [params, setParams] = useState({
    width: "",
    height: "",
    quantity: "1",
    cutLength: "",
    pricePerUnit: "",
    costPricePerUnit: "",
    filmPrice: "",
    filmCostPrice: "",
    laminationGloss: false,
    laminationMatte: false,
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
  const [priceSuggestions, setPriceSuggestions] = useState<Record<string, { price: number; unit: string }>>({});
  const [mediaEquipment, setMediaEquipment] = useState<{ id: string; name: string; workWidth: number; pricePerLm: number | null }[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/orders?status=active&limit=50").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/clients?limit=100").then((r) => r.json()),
      fetch("/api/equipment").then((r) => r.json()),
    ]).then(([ordersData, servicesData, clientsData, equipmentData]) => {
      setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : Array.isArray(ordersData) ? ordersData : []);
      setClients(Array.isArray(clientsData.clients) ? clientsData.clients : Array.isArray(clientsData) ? clientsData : []);
      if (Array.isArray(servicesData)) {
        const suggestions: Record<string, { price: number; unit: string }> = {};
        for (const s of servicesData) {
          if (s.type && s.isActive && !suggestions[s.type]) {
            suggestions[s.type] = { price: Number(s.price), unit: s.unit };
          }
        }
        setPriceSuggestions(suggestions);
      }
      if (Array.isArray(equipmentData)) {
        const media = equipmentData.filter((e: { workWidth: number | null; status: string }) => e.workWidth && e.status === "ACTIVE");
        setMediaEquipment(media);
      }
    });
  }, []);

  const isCutType = type === "LASER_CUT" || type === "PLOTTER_CUT";
  const isAreaType = !isCutType;

  function updateParam(key: string, value: string | boolean) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  async function calculate() {
    setLoading(true);
    const body: Record<string, unknown> = {
      type,
      pricePerUnit: Number(params.pricePerUnit) || 0,
      urgency: params.urgency,
      urgencyPercent: Number(params.urgencyPercent) || 30,
      laminationGloss: params.laminationGloss,
      laminationMatte: params.laminationMatte,
    };

    if (params.costPricePerUnit) body.costPricePerUnit = Number(params.costPricePerUnit);
    if (isAreaType) {
      body.width = Number(params.width) || 0;
      body.height = Number(params.height) || 0;
      body.quantity = Number(params.quantity) || 1;
      body.filmPrice = Number(params.filmPrice) || 0;
      if (params.filmCostPrice) body.filmCostPrice = Number(params.filmCostPrice);
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

    if (res.ok) {
      const data = await res.json();
      setResult(data);
    }
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
          name: itemName || ORDER_TYPE_LABELS[type as keyof typeof ORDER_TYPE_LABELS],
          qty: 1,
          unit: "шт",
          price: result.subtotal,
          discount: 0,
          total: result.subtotal,
        }),
      });
      if (res.ok) {
        setSavedOk(true);
        setTimeout(() => { setSavedOk(false); setSaveModalOpen(false); }, 1500);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveToInvoice() {
    if (!result || !invoiceClientId) return;
    setSavingInvoice(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: invoiceClientId,
          vatRate: 0,
          items: [{ name: invoiceItemName || ORDER_TYPE_LABELS[type as keyof typeof ORDER_TYPE_LABELS] || type, qty: 1, unit: "шт", price: result.subtotal }],
        }),
      });
      if (res.ok) {
        setSavedInvoiceOk(true);
        setTimeout(() => { setSavedInvoiceOk(false); setInvoiceModalOpen(false); setInvoiceClientId(""); setInvoiceItemName(""); }, 1500);
      }
    } finally {
      setSavingInvoice(false);
    }
  }

  const defaultPrices: Record<string, string> = {
    DTF: "1500",
    UV_DTF: "2200",
    UV_FLATBED: "3000",
    LASER_CUT: "0.12",
    PLOTTER_CUT: "80",
    HIGH_PRECISION: "2500",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calculator size={24} className="text-violet-600" />
          Калькулятор стоимости
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Рассчитайте стоимость заказа</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input panel */}
        <div className="space-y-4">
          <Card padding="md">
            <h2 className="font-semibold text-gray-800 mb-4">Параметры</h2>
            <div className="space-y-4">
              {/* Work type */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Тип работы</label>
                <div className="grid grid-cols-2 gap-2">
                  {WORK_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setType(t);
                        setParams((p) => ({ ...p, pricePerUnit: defaultPrices[t] || "" }));
                        setResult(null);
                      }}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors text-left ${
                        type === t
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-gray-700 border-gray-200 hover:border-violet-300"
                      }`}
                    >
                      {ORDER_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dimensions */}
              {isAreaType && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Оборудование / носитель
                    </label>
                    {mediaEquipment.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {mediaEquipment.map((eq) => (
                          <button
                            key={eq.id}
                            type="button"
                            onClick={() => {
                              setSelectedEquipmentId(eq.id);
                              updateParam("width", String(eq.workWidth));
                              if (eq.pricePerLm) updateParam("pricePerUnit", String(eq.pricePerLm));
                            }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors text-left ${
                              selectedEquipmentId === eq.id
                                ? "bg-violet-600 text-white border-violet-600"
                                : "bg-white text-gray-700 border-gray-200 hover:border-violet-300"
                            }`}
                          >
                            <span className="block">{eq.name}</span>
                            <span className="block opacity-75">{eq.workWidth} м{eq.pricePerLm ? ` · ${eq.pricePerLm} сом/пог.м` : ""}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mb-2">
                        Нет оборудования с заданной шириной.{" "}
                        <a href="/settings/equipment" className="text-violet-600 hover:underline">Добавить →</a>
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step={0.001}
                        value={params.width}
                        onChange={(e) => { setSelectedEquipmentId(""); updateParam("width", e.target.value); }}
                        placeholder="Или введите ширину вручную (м)"
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      {params.width && <span className="text-xs text-gray-500 shrink-0">{params.width} м</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Длина (м)"
                      type="number"
                      min={0}
                      step={0.01}
                      value={params.height}
                      onChange={(e) => updateParam("height", e.target.value)}
                      placeholder="0.50"
                    />
                    <Input
                      label="Тираж (шт)"
                      type="number"
                      min={1}
                      value={params.quantity}
                      onChange={(e) => updateParam("quantity", e.target.value)}
                    />
                  </div>
                </>
              )}

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">
                      {isCutType ? "Цена за мм / пог.м" : "Цена за пог.м"}
                    </label>
                    {priceSuggestions[type] && (
                      <button
                        type="button"
                        onClick={() => updateParam("pricePerUnit", String(priceSuggestions[type].price))}
                        className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                        title="Загрузить из справочника услуг"
                      >
                        из прайса: {priceSuggestions[type].price} ₽
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={params.pricePerUnit}
                    onChange={(e) => updateParam("pricePerUnit", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <Input
                  label="Себестоимость (₽)"
                  type="number"
                  min={0}
                  value={params.costPricePerUnit}
                  onChange={(e) => updateParam("costPricePerUnit", e.target.value)}
                  placeholder="Не обязательно"
                />
              </div>

              {type === "DTF" && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Цена плёнки (₽/м²)"
                    type="number"
                    min={0}
                    value={params.filmPrice}
                    onChange={(e) => updateParam("filmPrice", e.target.value)}
                    placeholder="50"
                  />
                  <Input
                    label="Себест. плёнки (₽/м²)"
                    type="number"
                    min={0}
                    value={params.filmCostPrice}
                    onChange={(e) => updateParam("filmCostPrice", e.target.value)}
                    placeholder="30"
                  />
                </div>
              )}

              {/* Lamination */}
              {isAreaType && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Ламинация (+400 ₽/м²)</p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="lamination"
                        checked={!params.laminationGloss && !params.laminationMatte}
                        onChange={() => { updateParam("laminationGloss", false); updateParam("laminationMatte", false); }}
                        className="accent-violet-600"
                      />
                      <span className="text-sm">Без ламинации</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="lamination"
                        checked={params.laminationGloss as boolean}
                        onChange={() => { updateParam("laminationGloss", true); updateParam("laminationMatte", false); }}
                        className="accent-violet-600"
                      />
                      <span className="text-sm">Глянец</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="lamination"
                        checked={params.laminationMatte as boolean}
                        onChange={() => { updateParam("laminationMatte", true); updateParam("laminationGloss", false); }}
                        className="accent-violet-600"
                      />
                      <span className="text-sm">Мат</span>
                    </label>
                  </div>
                </div>
              )}

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
                        <span>От (шт)</span>
                        <span>Скидка (%)</span>
                        <span />
                      </div>
                      {discountTiers.map((tier, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                          <input
                            type="number"
                            min={1}
                            value={tier.minQty}
                            onChange={(e) => setDiscountTiers((prev) => prev.map((t, i) => i === idx ? { ...t, minQty: e.target.value } : t))}
                            placeholder="100"
                            className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={tier.discountPct}
                            onChange={(e) => setDiscountTiers((prev) => prev.map((t, i) => i === idx ? { ...t, discountPct: e.target.value } : t))}
                            placeholder="5"
                            className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                          <button
                            type="button"
                            onClick={() => setDiscountTiers((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Urgency */}
              <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                <input
                  type="checkbox"
                  id="urgency"
                  checked={params.urgency as boolean}
                  onChange={(e) => updateParam("urgency", e.target.checked)}
                  className="accent-orange-600 w-4 h-4"
                />
                <label htmlFor="urgency" className="text-sm text-gray-700 cursor-pointer flex-1">
                  Срочность
                </label>
                {params.urgency && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={params.urgencyPercent}
                      onChange={(e) => updateParam("urgencyPercent", e.target.value)}
                      className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                )}
              </div>

              <Button onClick={calculate} loading={loading} className="w-full">
                <Calculator size={16} /> Рассчитать
              </Button>
            </div>
          </Card>
        </div>

        {/* Result panel */}
        <div>
          {result ? (
            <Card padding="md">
              <h2 className="font-semibold text-gray-800 mb-4">Результат расчёта</h2>

              {result.area !== null && (
                <div className="p-3 bg-gray-50 rounded-lg mb-4 flex gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Длина</p>
                    <p className="text-base font-bold text-gray-900">
                      {Number(params.height).toFixed(2)} пог.м
                    </p>
                  </div>
                  <div className="border-l border-gray-200 pl-4">
                    <p className="text-xs text-gray-500">Площадь</p>
                    <p className="text-base font-bold text-gray-900">{result.area.toFixed(4)} м²</p>
                  </div>
                  <div className="border-l border-gray-200 pl-4">
                    <p className="text-xs text-gray-500">Ширина рулона</p>
                    <p className="text-base font-bold text-gray-900">{params.width} м</p>
                  </div>
                </div>
              )}

              {/* Breakdown */}
              <div className="space-y-2 mb-4">
                {result.breakdown.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between py-2 border-b border-gray-100 ${item.value < 0 ? "text-green-700" : ""}`}
                  >
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <span className="text-sm font-medium">{formatCurrency(Math.abs(item.value))}</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="p-4 bg-violet-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-gray-900">ИТОГО</span>
                  <span className="text-2xl font-bold text-violet-700">
                    {formatCurrency(result.subtotal)}
                  </span>
                </div>
                {result.pricePerUnit && (
                  <p className="text-xs text-gray-500 mt-1 text-right">
                    {formatCurrency(result.pricePerUnit)} за штуку
                  </p>
                )}
              </div>

              {/* Margin */}
              {result.costTotal !== null && result.margin !== null && (
                <div className="p-4 bg-gray-50 rounded-xl space-y-2">
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
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigator.clipboard.writeText(formatCurrency(result.subtotal))}
                >
                  Скопировать
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setInvoiceItemName(ORDER_TYPE_LABELS[type as keyof typeof ORDER_TYPE_LABELS] || type);
                    setInvoiceModalOpen(true);
                  }}
                >
                  <FileText size={15} /> В счёт
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setItemName(ORDER_TYPE_LABELS[type as keyof typeof ORDER_TYPE_LABELS] || type);
                    setSaveModalOpen(true);
                  }}
                >
                  <ShoppingCart size={15} /> В заявку
                </Button>
              </div>
            </Card>
          ) : (
            <Card padding="md" className="flex flex-col items-center justify-center h-64 text-center">
              <Calculator size={48} className="text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm">Заполните параметры и нажмите «Рассчитать»</p>
            </Card>
          )}

          {/* Pricing reference */}
          <Card padding="md" className="mt-4">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">Справочные цены</h3>
            <div className="space-y-1.5">
              {[
                { label: "DTF-печать", price: "1 500 сом/пог.м" },
                { label: "UV DTF наклейки", price: "2 200 сом/пог.м" },
                { label: "UV планшет", price: "3 000 сом/пог.м" },
                { label: "Лазерная резка", price: "0.12 сом/мм" },
                { label: "Плоттерная резка", price: "80 сом/пог.м" },
                { label: "Ламинация", price: "400 сом/м²" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between text-xs">
                  <span className="text-gray-500">{item.label}</span>
                  <span className="font-medium text-gray-700">{item.price}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        title="Создать счёт из расчёта"
      >
        <div className="space-y-4">
          <div className="p-3 bg-violet-50 rounded-lg">
            <p className="text-sm text-gray-600">Сумма:</p>
            <p className="text-xl font-bold text-violet-700">{result ? formatCurrency(result.subtotal) : "—"}</p>
          </div>
          <Input
            label="Название позиции"
            value={invoiceItemName}
            onChange={(e) => setInvoiceItemName(e.target.value)}
            placeholder="DTF-печать и т.д."
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Клиент *</label>
            <select
              value={invoiceClientId}
              onChange={(e) => setInvoiceClientId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">— выберите клиента —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
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

      <Modal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Добавить позицию в заявку"
      >
        <div className="space-y-4">
          <div className="p-3 bg-violet-50 rounded-lg">
            <p className="text-sm text-gray-600">Сумма позиции:</p>
            <p className="text-xl font-bold text-violet-700">{result ? formatCurrency(result.subtotal) : "—"}</p>
          </div>

          <Input
            label="Название позиции"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="DTF-печать, визитки и т.д."
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Заявка</label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">— выберите заявку —</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.number} — {o.client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSaveModalOpen(false)}>Отмена</Button>
            <Button
              onClick={handleSaveToOrder}
              loading={saving}
              disabled={!selectedOrderId || !itemName.trim()}
            >
              {savedOk ? <><Check size={14} /> Добавлено</> : "Добавить в заявку"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
