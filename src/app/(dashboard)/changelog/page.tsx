"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Link from "next/link";
import { History, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ChangeLogEntry {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { id: string; name: string; role: string };
  order: { id: string; number: string };
}

const FIELD_LABELS: Record<string, string> = {
  status: "Статус",
  priority: "Приоритет",
  deadline: "Срок сдачи",
  assignees: "Исполнители",
  managerId: "Менеджер",
  amount: "Сумма",
  paymentStatus: "Статус оплаты",
  type: "Тип заказа",
  description: "Описание",
  clientId: "Клиент",
  equipmentId: "Оборудование",
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "Новая", IN_PROGRESS: "В работе", REVIEW: "На проверке",
  READY: "Готово", ISSUED: "Выдано", CANCELLED: "Отменено",
  UNPAID: "Не оплачен", ADVANCE: "Аванс", PAID: "Оплачен",
  LOW: "Низкий", NORMAL: "Обычный", URGENT: "Срочный", VERY_URGENT: "Очень срочный",
};

function formatValue(field: string, value: string | null): string {
  if (!value) return "—";
  if (field === "status" || field === "paymentStatus" || field === "priority") {
    return STATUS_LABELS[value] ?? value;
  }
  if (field === "deadline" || field.endsWith("At")) {
    try { return new Date(value).toLocaleString("ru-RU"); } catch { return value; }
  }
  return value;
}

export default function ChangelogPage() {
  const [logs, setLogs] = useState<ChangeLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set("orderId", debouncedSearch);
      const res = await fetch(`/api/changelog?${params}`);
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <History size={22} className="text-violet-500" />
            Журнал изменений
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            История всех изменений заявок · {total} записей
          </p>
        </div>
      </div>

      <Card padding="none">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Поиск по ID заявки..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:text-slate-500 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400 dark:text-slate-500">Загрузка...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400 dark:text-slate-500">Изменений пока нет</div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-700">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 px-5 py-3 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/40 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-violet-600">{log.user.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{log.user.name}</span>
                    <Badge variant="default" className="text-xs">{log.user.role}</Badge>
                    <span className="text-xs text-gray-400 dark:text-slate-500">изменил(а)</span>
                    <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                      {FIELD_LABELS[log.field] ?? log.field}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">в заявке</span>
                    <Link
                      href={`/orders/${log.order.id}`}
                      className="text-xs font-medium text-violet-600 hover:underline"
                    >
                      {log.order.number}
                    </Link>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="text-gray-500 dark:text-slate-500 line-through">{formatValue(log.field, log.oldValue)}</span>
                    <span className="text-gray-400 dark:text-slate-500">→</span>
                    <span className="text-gray-800 dark:text-slate-200 font-medium">{formatValue(log.field, log.newValue)}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0 mt-0.5">{formatDate(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-slate-700">
            <span className="text-xs text-gray-500 dark:text-slate-400">Страница {page} из {pages}</span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
