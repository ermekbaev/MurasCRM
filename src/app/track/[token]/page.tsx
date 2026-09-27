import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/branding.server";
import { Check, Package, Clock, X } from "lucide-react";
import type { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/** Шаги для клиента. Внутренние статусы сводим к понятным четырём. */
const STEPS = ["Принята", "В работе", "Готова", "Выдана"];

const STEP_BY_STATUS: Record<OrderStatus, number> = {
  NEW: 0,
  IN_PROGRESS: 1,
  REVIEW: 1,
  READY: 2,
  ISSUED: 3,
  CANCELLED: -1,
};

function fmtDate(d: Date | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [order, brand] = await Promise.all([
    prisma.order.findFirst({
      where: { publicToken: token },
      select: {
        number: true,
        title: true,
        status: true,
        deadline: true,
        updatedAt: true,
        items: { select: { name: true, qty: true, unit: true } },
      },
    }),
    getBranding(),
  ]);

  if (!order) notFound();

  const cancelled = order.status === "CANCELLED";
  const current = STEP_BY_STATUS[order.status];
  const deadline = fmtDate(order.deadline);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Image src={brand.logo} alt={brand.name} width={28} height={28} className="h-7 w-auto max-h-7 object-contain" unoptimized />
          <span className="text-sm font-semibold text-fg">{brand.name}</span>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <p className="text-xs text-fg-subtle">Заказ</p>
          <h1 className="mt-0.5 text-xl font-semibold text-fg">{order.number}</h1>
          {order.title && <p className="mt-1 text-sm text-fg-muted">{order.title}</p>}

          {cancelled ? (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              <X size={18} /> Заказ отменён. По вопросам свяжитесь с нами.
            </div>
          ) : (
            <div className="mt-7">
              {/* Шаги: пройденные — с галкой, текущий — подсвечен. */}
              <div className="flex items-start justify-between">
                {STEPS.map((label, i) => {
                  const done = i < current;
                  const active = i === current;
                  return (
                    <div key={label} className="flex flex-1 flex-col items-center text-center">
                      <div className="flex w-full items-center">
                        <div className={"h-0.5 flex-1 " + (i === 0 ? "opacity-0" : done || active ? "bg-accent" : "bg-line")} />
                        <div
                          className={
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                            (done
                              ? "bg-accent text-on-accent"
                              : active
                                ? "bg-accent-soft text-accent-fg ring-2 ring-inset ring-accent"
                                : "bg-surface-hover text-fg-subtle")
                          }
                        >
                          {done ? <Check size={15} /> : active ? <Clock size={15} /> : i + 1}
                        </div>
                        <div className={"h-0.5 flex-1 " + (i === STEPS.length - 1 ? "opacity-0" : done ? "bg-accent" : "bg-line")} />
                      </div>
                      <span className={"mt-2 text-[11px] leading-tight " + (done || active ? "font-medium text-fg" : "text-fg-subtle")}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 rounded-xl bg-surface-sunken px-4 py-3 text-center">
                <p className="text-xs text-fg-subtle">Текущий статус</p>
                <p className="mt-0.5 text-base font-semibold text-accent-fg">
                  {current === 3 ? "Готов и выдан" : STEPS[current]}
                </p>
              </div>
            </div>
          )}

          {order.items.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">Состав заказа</p>
              <ul className="space-y-1.5">
                {order.items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-3 text-sm">
                    <span className="text-fg">{it.name}</span>
                    <span className="shrink-0 text-fg-muted">
                      {Number(it.qty)} {it.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {deadline && !cancelled && (
            <div className="mt-6 flex items-center gap-2 text-sm text-fg-muted">
              <Package size={15} className="text-fg-subtle" /> Готовность к {deadline}
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-fg-subtle">
          Обновлено {new Date(order.updatedAt).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
    </div>
  );
}
