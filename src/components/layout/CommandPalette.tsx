"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ShoppingCart, Users, FileText, CornerDownLeft } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@prisma/client";

interface Results {
  orders: { id: string; number: string; title: string | null; status: OrderStatus; client: { name: string } | null }[];
  clients: { id: string; name: string; phone: string | null; inn: string | null }[];
  invoices: { id: string; number: string; total: number; client: { name: string } | null }[];
}

interface Flat {
  href: string;
  primary: string;
  secondary: string;
  icon: "order" | "client" | "invoice";
}

const empty: Results = { orders: [], clients: [], invoices: [] };

/**
 * Глобальный поиск по Ctrl/⌘+K.
 *
 * Открывается сочетанием клавиш или событием «open-search» — так открыть его
 * может любая кнопка в интерфейсе без проброса пропсов. Запрос уходит с
 * задержкой, чтобы не дёргать сервер на каждую букву. Стрелки и Enter водят по
 * результатам.
 */
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results>(empty);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Плоский список для навигации стрелками — в порядке отображения.
  const flat: Flat[] = [
    ...results.orders.map((o) => ({
      href: `/orders/${o.id}`,
      primary: `${o.number}${o.title ? ` — ${o.title}` : ""}`,
      secondary: [o.client?.name, ORDER_STATUS_LABELS[o.status]].filter(Boolean).join(" · "),
      icon: "order" as const,
    })),
    ...results.clients.map((c) => ({
      href: `/clients/${c.id}`,
      primary: c.name,
      secondary: [c.phone, c.inn && `ИНН ${c.inn}`].filter(Boolean).join(" · "),
      icon: "client" as const,
    })),
    ...results.invoices.map((i) => ({
      href: `/invoices/${i.id}`,
      primary: `Счёт ${i.number}`,
      secondary: [i.client?.name, formatCurrency(i.total)].filter(Boolean).join(" · "),
      icon: "invoice" as const,
    })),
  ];

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults(empty);
    setActive(0);
  }, []);

  // Горячая клавиша и внешнее событие открытия.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Поиск с задержкой.
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setResults(empty);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => (r.ok ? r.json() : empty))
        .then((d: Results) => {
          setResults(d);
          setActive(0);
        })
        .catch(() => setResults(empty))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  function go(href: string) {
    close();
    router.push(href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      go(flat[active].href);
    } else if (e.key === "Escape") {
      close();
    }
  }

  if (!open) return null;

  const iconFor = (t: Flat["icon"]) =>
    t === "order" ? <ShoppingCart size={15} /> : t === "client" ? <Users size={15} /> : <FileText size={15} />;

  let idx = -1;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onClick={close}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line-soft px-4">
          <Search size={17} className="shrink-0 text-fg-subtle" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Поиск заявок, клиентов, счетов..."
            className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
          />
          {loading && <Loader2 size={15} className="shrink-0 animate-spin text-fg-subtle" />}
        </div>

        <div className="max-h-[55vh] overflow-y-auto py-2">
          {q.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-sm text-fg-subtle">
              Начните вводить — минимум 2 символа
            </p>
          ) : flat.length === 0 && !loading ? (
            <p className="px-4 py-6 text-center text-sm text-fg-subtle">Ничего не нашлось</p>
          ) : (
            <>
              <Group title="Заявки" show={results.orders.length > 0}>
                {results.orders.map((o) => {
                  idx++;
                  const i = idx;
                  return (
                    <Row key={o.id} active={i === active} onClick={() => go(`/orders/${o.id}`)} onHover={() => setActive(i)} icon={iconFor("order")}
                      primary={`${o.number}${o.title ? ` — ${o.title}` : ""}`}
                      secondary={[o.client?.name, ORDER_STATUS_LABELS[o.status]].filter(Boolean).join(" · ")} />
                  );
                })}
              </Group>
              <Group title="Клиенты" show={results.clients.length > 0}>
                {results.clients.map((c) => {
                  idx++;
                  const i = idx;
                  return (
                    <Row key={c.id} active={i === active} onClick={() => go(`/clients/${c.id}`)} onHover={() => setActive(i)} icon={iconFor("client")}
                      primary={c.name}
                      secondary={[c.phone, c.inn && `ИНН ${c.inn}`].filter(Boolean).join(" · ")} />
                  );
                })}
              </Group>
              <Group title="Счета" show={results.invoices.length > 0}>
                {results.invoices.map((inv) => {
                  idx++;
                  const i = idx;
                  return (
                    <Row key={inv.id} active={i === active} onClick={() => go(`/invoices/${inv.id}`)} onHover={() => setActive(i)} icon={iconFor("invoice")}
                      primary={`Счёт ${inv.number}`}
                      secondary={[inv.client?.name, formatCurrency(inv.total)].filter(Boolean).join(" · ")} />
                  );
                })}
              </Group>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-line-soft px-4 py-2 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-1"><CornerDownLeft size={12} /> открыть</span>
          <span>↑↓ выбрать</span>
          <span>Esc закрыть</span>
        </div>
      </div>
    </div>
  );
}

function Group({ title, show, children }: { title: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div className="mb-1">
      <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">{title}</p>
      {children}
    </div>
  );
}

function Row({
  active,
  onClick,
  onHover,
  icon,
  primary,
  secondary,
}: {
  active: boolean;
  onClick: () => void;
  onHover: () => void;
  icon: React.ReactNode;
  primary: string;
  secondary: string;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={"flex w-full items-center gap-3 px-4 py-2 text-left " + (active ? "bg-accent-soft" : "hover:bg-surface-hover")}
    >
      <span className={"shrink-0 " + (active ? "text-accent" : "text-fg-subtle")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-fg">{primary}</span>
        {secondary && <span className="block truncate text-xs text-fg-subtle">{secondary}</span>}
      </span>
    </button>
  );
}
