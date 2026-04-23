"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  PRIORITY_LABELS,
} from "@/lib/constants";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, ShoppingCart, DollarSign, BarChart3, FileDown, FileText } from "lucide-react";

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

const PERIODS = [
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "quarter", label: "Квартал" },
  { value: "year", label: "Год" },
];

interface AnalyticsData {
  summary: {
    revenue: number;
    prevRevenue: number;
    revGrowth: number | null;
    ordersCount: number;
    prevOrdersCount: number;
    avgCheck: number;
  };
  ordersByStatus: { status: string; count: number }[];
  ordersByType: { type: string; count: number; revenue: number }[];
  ordersByPriority: { priority: string; count: number }[];
  topServices: { name: string; count: number; revenue: number }[];
  monthlyRevenue: { month: string; amount: number }[];
  operatorLoad: { name: string; role: string; tasks: number }[];
  equipmentLoad: { name: string; type: string; orders: number }[];
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period]);

  async function handleExportExcel() {
    if (!data) return;
    setExporting(true);
    try {
      const { utils, writeFile } = await import("xlsx");
      const periodLabel = PERIODS.find((p) => p.value === period)?.label || period;
      const wb = utils.book_new();

      // Sheet 1: Summary
      const summarySheet = utils.aoa_to_sheet([
        ["Период", periodLabel],
        ["Выручка", data.summary.revenue],
        ["Заказов", data.summary.ordersCount],
        ["Средний чек", data.summary.avgCheck],
        ["Выручка (пред. период)", data.summary.prevRevenue],
        ["Рост выручки %", data.summary.revGrowth ?? "—"],
      ]);
      utils.book_append_sheet(wb, summarySheet, "Сводка");

      // Sheet 2: Monthly revenue
      const monthlySheet = utils.aoa_to_sheet([
        ["Месяц", "Выручка"],
        ...data.monthlyRevenue.map((r) => [r.month, r.amount]),
      ]);
      utils.book_append_sheet(wb, monthlySheet, "По месяцам");

      // Sheet 3: By type
      const typeSheet = utils.aoa_to_sheet([
        ["Тип работ", "Заказов", "Выручка"],
        ...data.ordersByType.map((r) => [
          ORDER_TYPE_LABELS[r.type as keyof typeof ORDER_TYPE_LABELS] || r.type,
          r.count,
          r.revenue,
        ]),
      ]);
      utils.book_append_sheet(wb, typeSheet, "По типам");

      // Sheet 4: Top services
      const servicesSheet = utils.aoa_to_sheet([
        ["Услуга", "Заказов", "Выручка"],
        ...data.topServices.map((s) => [s.name, s.count, s.revenue]),
      ]);
      utils.book_append_sheet(wb, servicesSheet, "Топ услуг");

      writeFile(wb, `Аналитика_${periodLabel}_${new Date().toLocaleDateString("ru-RU")}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPDF() {
    if (!data) return;
    setExportingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const periodLabel = PERIODS.find((p) => p.value === period)?.label || period;
      const doc = new jsPDF();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Аналитика", 14, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Период: ${periodLabel} | Дата: ${new Date().toLocaleDateString("ru-RU")}`, 14, 26);

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Сводка", 14, 38);
      autoTable(doc, {
        startY: 42,
        head: [["Показатель", "Значение"]],
        body: [
          ["Выручка", `${data.summary.revenue.toLocaleString("ru-RU")} руб.`],
          ["Выручка (пред. период)", `${data.summary.prevRevenue.toLocaleString("ru-RU")} руб.`],
          ["Заказов", String(data.summary.ordersCount)],
          ["Средний чек", `${data.summary.avgCheck.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} руб.`],
          ["Рост выручки", data.summary.revGrowth !== null ? `${data.summary.revGrowth.toFixed(1)}%` : "—"],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [99, 102, 241] },
      });

      const y1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 0 + 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Топ-5 услуг", 14, y1);
      autoTable(doc, {
        startY: y1 + 4,
        head: [["Услуга", "Заказов", "Выручка"]],
        body: data.topServices.map((s) => [
          s.name,
          String(s.count),
          `${s.revenue.toLocaleString("ru-RU")} руб.`,
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [99, 102, 241] },
      });

      const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 0 + 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Выручка по типам работ", 14, y2);
      autoTable(doc, {
        startY: y2 + 4,
        head: [["Тип", "Заказов", "Выручка"]],
        body: data.ordersByType.map((t) => [
          t.type,
          String(t.count),
          `${t.revenue.toLocaleString("ru-RU")} руб.`,
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [99, 102, 241] },
      });

      if (data.operatorLoad?.length) {
        const y3 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 0 + 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Загруженность сотрудников", 14, y3);
        autoTable(doc, {
          startY: y3 + 4,
          head: [["Сотрудник", "Задач"]],
          body: data.operatorLoad.map((o) => [o.name, String(o.tasks)]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [99, 102, 241] },
        });
      }

      doc.save(`Аналитика_${periodLabel}_${new Date().toLocaleDateString("ru-RU")}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-gray-400">Загрузка данных...</div>
      </div>
    );
  }

  const { summary } = data;

  const GrowthIndicator = ({ value }: { value: number | null }) => {
    if (value === null) return <span className="text-gray-400 text-xs">—</span>;
    if (value > 0) return (
      <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
        <TrendingUp size={12} /> +{value.toFixed(1)}%
      </span>
    );
    if (value < 0) return (
      <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
        <TrendingDown size={12} /> {value.toFixed(1)}%
      </span>
    );
    return <span className="flex items-center gap-1 text-gray-400 text-xs"><Minus size={12} /> 0%</span>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={24} className="text-violet-600" />
            Аналитика
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExportExcel} loading={exporting}>
            <FileDown size={15} /> Excel
          </Button>
          <Button variant="outline" onClick={handleExportPDF} loading={exportingPdf}>
            <FileText size={15} /> PDF
          </Button>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                period === p.value
                  ? "bg-violet-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Выручка</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.revenue)}</p>
              <div className="mt-1">
                <GrowthIndicator value={summary.revGrowth} />
              </div>
            </div>
            <div className="p-2.5 bg-violet-50 rounded-lg text-violet-600">
              <DollarSign size={20} />
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Заказов</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary.ordersCount}</p>
              <p className="text-xs text-gray-400 mt-1">
                было: {summary.prevOrdersCount}
              </p>
            </div>
            <div className="p-2.5 bg-green-50 rounded-lg text-green-600">
              <ShoppingCart size={20} />
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Средний чек</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.avgCheck)}</p>
            </div>
            <div className="p-2.5 bg-purple-50 rounded-lg text-purple-600">
              <TrendingUp size={20} />
            </div>
          </div>
        </Card>
      </div>

      {/* Revenue chart */}
      <Card padding="md">
        <h2 className="font-semibold text-gray-800 mb-4">Выручка по месяцам (12 мес.)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.monthlyRevenue}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
            <Tooltip formatter={(v) => [formatCurrency(Number(v)), "Выручка"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} fill="url(#grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by type */}
        <Card padding="md">
          <h2 className="font-semibold text-gray-800 mb-4">Выручка по типам услуг</h2>
          {data.ordersByType.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Нет данных</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.ordersByType.map((d) => ({
                name: (ORDER_TYPE_LABELS[d.type as keyof typeof ORDER_TYPE_LABELS] ?? d.type).slice(0, 10),
                revenue: d.revenue,
                count: d.count,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
                <Tooltip formatter={(v, name) => [name === "revenue" ? formatCurrency(Number(v)) : v, name === "revenue" ? "Выручка" : "Позиций"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Orders by status */}
        <Card padding="md">
          <h2 className="font-semibold text-gray-800 mb-4">Заявки по статусам</h2>
          {data.ordersByStatus.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Нет данных</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={data.ordersByStatus.map((d) => ({
                      name: ORDER_STATUS_LABELS[d.status as keyof typeof ORDER_STATUS_LABELS] || d.status,
                      value: d.count,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {data.ordersByStatus.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {data.ordersByStatus.map((d, idx) => (
                  <div key={d.status} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                      <span className="text-gray-600 text-xs">
                        {ORDER_STATUS_LABELS[d.status as keyof typeof ORDER_STATUS_LABELS] || d.status}
                      </span>
                    </span>
                    <span className="font-medium text-gray-800">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Top services */}
        <Card padding="md">
          <h2 className="font-semibold text-gray-800 mb-4">Топ-5 услуг по выручке</h2>
          {data.topServices.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Нет данных</div>
          ) : (
            <div className="space-y-3">
              {data.topServices.map((s, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 truncate flex-1">{s.name}</span>
                    <span className="font-semibold text-gray-900 ml-2">{formatCurrency(s.revenue)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full"
                      style={{
                        width: `${data.topServices[0] ? (s.revenue / data.topServices[0].revenue) * 100 : 0}%`,
                        background: COLORS[idx % COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Orders by priority */}
        <Card padding="md">
          <h2 className="font-semibold text-gray-800 mb-4">Заявки по приоритетам</h2>
          {data.ordersByPriority.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Нет данных</div>
          ) : (
            <div className="space-y-2">
              {data.ordersByPriority
                .sort((a, b) => {
                  const order = ["VERY_URGENT", "URGENT", "NORMAL", "LOW"];
                  return order.indexOf(a.priority) - order.indexOf(b.priority);
                })
                .map((d) => {
                  const total = data.ordersByPriority.reduce((sum, x) => sum + x.count, 0);
                  const pct = total > 0 ? (d.count / total) * 100 : 0;
                  return (
                    <div key={d.priority}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">
                          {PRIORITY_LABELS[d.priority as keyof typeof PRIORITY_LABELS] || d.priority}
                        </span>
                        <span className="font-medium text-gray-800">
                          {d.count} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: "#6366f1" }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      </div>

      {/* Equipment load */}
      {data.equipmentLoad && data.equipmentLoad.length > 0 && (
        <Card padding="md">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-violet-600" />
            Загруженность оборудования (активные заявки)
          </h2>
          <div className="space-y-3">
            {data.equipmentLoad.map((eq, idx) => {
              const max = data.equipmentLoad[0]?.orders || 1;
              const pct = (eq.orders / max) * 100;
              const color = pct >= 80 ? "#ef4444" : pct >= 50 ? "#f59e0b" : "#10b981";
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{eq.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{eq.type}</span>
                      <span className="font-semibold text-gray-900">{eq.orders} заявок</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Operator load */}
      {data.operatorLoad && data.operatorLoad.length > 0 && (
        <Card padding="md">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-violet-600" />
            Загруженность сотрудников (задачи за период)
          </h2>
          <div className="space-y-3">
            {data.operatorLoad.map((op, idx) => {
              const max = data.operatorLoad[0]?.tasks || 1;
              const pct = (op.tasks / max) * 100;
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{op.name}</span>
                    <span className="text-gray-500 font-semibold">{op.tasks} задач</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: COLORS[idx % COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
