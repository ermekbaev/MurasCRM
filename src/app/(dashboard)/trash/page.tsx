"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { formatDateTime } from "@/lib/utils";
import { Trash2, RotateCcw, X } from "lucide-react";

interface TrashItem {
  type: string;
  typeLabel: string;
  id: string;
  title: string;
  subtitle: string;
  deletedAt: string;
  deletedBy: string;
}

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [keepDays, setKeepDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetch("/api/trash").then((r) => (r.ok ? r.json() : null));
    setItems(data?.items ?? []);
    if (data?.keepDays) setKeepDays(data.keepDays);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(item: TrashItem, action: "restore" | "purge") {
    if (
      action === "purge" &&
      !confirm(
        `Удалить «${item.title}» навсегда? Это последний шаг — вернуть уже не получится.`,
      )
    ) {
      return;
    }

    setBusy(item.id);
    setError(null);
    try {
      const res = await fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: item.type, id: item.id, action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(typeof body?.error === "string" ? body.error : "Не удалось выполнить действие");
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="p-6 text-fg-subtle">Загрузка...</div>;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        icon={<Trash2 size={18} />}
        title="Корзина"
        subtitle={`Удалённое хранится ${keepDays} дней, потом вычищается само`}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <Card padding="md">
          <div className="py-12 text-center text-fg-subtle">
            <Trash2 size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm text-fg">Корзина пуста</p>
            <p className="mx-auto mt-2 max-w-md text-xs">
              Сюда попадают удалённые заявки, клиенты, счета, акты и накладные.
              Пока запись здесь, её можно вернуть со всем содержимым.
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-line-soft">
            {items.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 px-4 py-3">
                <span className="w-24 shrink-0 rounded-full bg-surface-hover px-2 py-0.5 text-center text-[11px] text-fg-muted">
                  {item.typeLabel}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{item.title}</p>
                  {item.subtitle && (
                    <p className="truncate text-xs text-fg-muted">{item.subtitle}</p>
                  )}
                </div>
                <div className="hidden shrink-0 text-right text-xs text-fg-subtle sm:block">
                  <p>{formatDateTime(item.deletedAt)}</p>
                  <p>удалил: {item.deletedBy}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(item, "restore")}
                    loading={busy === item.id}
                  >
                    <RotateCcw size={14} /> Вернуть
                  </Button>
                  <button
                    onClick={() => act(item, "purge")}
                    disabled={busy === item.id}
                    title="Удалить навсегда"
                    className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-900/30"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
