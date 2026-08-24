"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/layout/PageHeader";
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
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        icon={<History size={18} className="text-accent" />}
        title="Журнал изменений"
        subtitle={`История всех изменений заявок · ${total} записей`}
      />

      <Card padding="none">
        <div className="px-5 py-3 border-b border-line-soft">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              type="text"
              placeholder="Поиск по ID заявки..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-line rounded-lg bg-surface text-fg placeholder:text-fg-subtle dark:placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-fg-subtle">Загрузка...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-fg-subtle">Изменений пока нет</div>
        ) : (
          <div className="divide-y divide-line-soft">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 px-5 py-3 hover:bg-surface-sunken dark:hover:bg-slate-700/50 transition-colors">
                <div className="w-8 h-8 bg-accent-soft rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-accent">{log.user.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-fg">{log.user.name}</span>
                    <Badge variant="default" className="text-xs">{log.user.role}</Badge>
                    <span className="text-xs text-fg-subtle">изменил(а)</span>
                    <span className="text-xs font-semibold text-fg-muted">
                      {FIELD_LABELS[log.field] ?? log.field}
                    </span>
                    <span className="text-xs text-fg-subtle">в заявке</span>
                    <Link
                      href={`/orders/${log.order.id}`}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      {log.order.number}
                    </Link>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="text-fg-muted line-through">{formatValue(log.field, log.oldValue)}</span>
                    <span className="text-fg-subtle">→</span>
                    <span className="text-fg font-medium">{formatValue(log.field, log.newValue)}</span>
                  </div>
                </div>
                <span className="text-xs text-fg-subtle shrink-0 mt-0.5">{formatDate(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-line-soft">
            <span className="text-xs text-fg-muted">Страница {page} из {pages}</span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded hover:bg-surface-hover dark:hover:bg-slate-700 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded hover:bg-surface-hover dark:hover:bg-slate-700 disabled:opacity-40"
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
