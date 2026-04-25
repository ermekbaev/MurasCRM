"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Card from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";

export default function DashboardCharts() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const gridColor = isDark ? "#334155" : "#f0f0f0";
  const tickColor = isDark ? "#94a3b8" : "#6b7280";
  const tooltipStyle = isDark
    ? { background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9", fontSize: 12, borderRadius: 8 }
    : { border: "1px solid #e5e7eb", fontSize: 12, borderRadius: 8 };

  const [data, setData] = useState<{ date: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setData(d.chartData || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <Card padding="md">
      <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-4">Выручка за последние 30 дней</h2>
      {loading ? (
        <div className="h-48 flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">
          Загрузка...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: tickColor }}
              tickLine={false}
              axisLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fontSize: 11, fill: tickColor }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value)), "Выручка"]}
              contentStyle={tooltipStyle}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#revenueGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
