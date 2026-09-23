"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/layout/PageHeader";
import EntryModal from "./EntryModal";
import { formatCurrency } from "@/lib/utils";
import { isoDate } from "@/lib/money-period";
import { accountKindHint } from "@/lib/money";
import type {
  ExpenseCategory,
  ExpenseRow,
  MoneyAccount,
  MoneyReport,
  PaymentRow,
} from "@/lib/money";
import {
  Wallet,
  Plus,
  Minus,
  Trash2,
  Calendar,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Receipt,
  Settings2,
} from "lucide-react";

type Tab = "income" | "expense";
type Period = "month" | "prev" | "custom";

const PERIODS: { value: Period; label: string }[] = [
  { value: "month", label: "Месяц" },
  { value: "prev", label: "Прошлый" },
  { value: "custom", label: "Период" },
];

function monthRange(offset = 0) {
  const n = new Date();
  const from = new Date(n.getFullYear(), n.getMonth() + offset, 1);
  const to = offset === 0 ? n : new Date(n.getFullYear(), n.getMonth() + offset + 1, 0);
  return { from: isoDate(from), to: isoDate(to) };
}

export default function MoneyPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState(() => monthRange().from);
  const [to, setTo] = useState(() => monthRange().to);
  const [tab, setTab] = useState<Tab>("expense");

  const [report, setReport] = useState<MoneyReport | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<Tab | null>(null);

  const load = useCallback(async () => {
    const range = `from=${from}&to=${to}`;
    const [r, p, e] = await Promise.all([
      fetch(`/api/money/report?${range}`).then((x) => (x.ok ? x.json() : null)),
      fetch(`/api/payments?${range}`).then((x) => (x.ok ? x.json() : null)),
      fetch(`/api/expenses?${range}`).then((x) => (x.ok ? x.json() : null)),
    ]);
    setReport(r);
    setPayments(p?.items ?? []);
    setExpenses(e?.items ?? []);
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/settings/money-accounts")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAccounts(Array.isArray(d) ? d : []));
    fetch("/api/settings/expense-categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCategories(Array.isArray(d) ? d : []));
  }, []);

  function choosePeriod(next: Period) {
    setPeriod(next);
    if (next === "month") {
      const r = monthRange();
      setFrom(r.from);
      setTo(r.to);
    } else if (next === "prev") {
      const r = monthRange(-1);
      setFrom(r.from);
      setTo(r.to);
    }
  }

  async function removeExpense(id: string) {
    if (!confirm("Удалить запись о расходе? Её можно будет вернуть из корзины.")) return;
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function removePayment(id: string) {
    if (!confirm("Удалить запись о приходе? Вернуть её будет нельзя.")) return;
    const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
    if (res.ok) {
      load();
      return;
    }
    const body = await res.json().catch(() => null);
    alert(body?.error ?? "Не удалось удалить приход");
  }

  const day = (iso: string) => new Date(iso).toLocaleDateString("ru-RU");
  const totals = report?.totals;
  const profit = totals?.profit ?? 0;

  const dateField =
    "h-9.5 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-fg-muted " +
    "focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={<Wallet size={18} className="text-accent" />}
        title="Деньги"
        subtitle="Приход и расход по счетам — сколько и по какой карте прошло"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {period === "custom" && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-fg-subtle" />
                <input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                  className={dateField}
                />
                <span className="text-sm text-fg-subtle">—</span>
                <input
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                  className={dateField}
                />
              </div>
            )}
            <div className="flex rounded-lg border border-line bg-surface p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => choosePeriod(p.value)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    period === p.value
                      ? "bg-accent-soft text-accent-fg"
                      : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {p.value === "custom" && <Calendar size={13} />}
                  {p.label}
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => setAdding("income")}>
              <Plus size={15} /> Приход
            </Button>
            <Button onClick={() => setAdding("expense")}>
              <Minus size={15} /> Расход
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="py-16 text-center text-fg-subtle">Загрузка...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Приход за период"
              value={formatCurrency(totals?.income ?? 0)}
              icon={<ArrowDownCircle size={18} />}
              color="text-emerald-600 bg-emerald-50 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
            />
            <Stat
              label="Расход за период"
              value={formatCurrency(totals?.expense ?? 0)}
              icon={<ArrowUpCircle size={18} />}
              color="text-rose-600 bg-rose-50 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20"
            />
            <Stat
              label="Разница"
              value={formatCurrency(profit)}
              icon={<TrendingUp size={18} />}
              color="text-accent bg-accent-soft ring-accent/15"
              valueClass={
                profit < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
              }
            />
            <Stat
              label="Остаток на счетах"
              value={formatCurrency(totals?.balance ?? 0)}
              icon={<Wallet size={18} />}
              color="text-sky-600 bg-sky-50 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* По счетам */}
            <div className="lg:col-span-2">
              <Card padding="none" className="h-full">
                <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
                  <div>
                    <h2 className="flex items-center gap-2 font-semibold text-fg">
                      <Wallet size={16} className="text-accent" /> По счетам
                    </h2>
                    <p className="mt-0.5 text-xs text-fg-subtle">
                      Обороты — за период, остаток — на сегодня
                    </p>
                  </div>
                  <Link
                    href="/settings/money-accounts"
                    className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                  >
                    <Settings2 size={13} /> Настроить
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line-soft bg-surface-sunken">
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase text-fg-muted">
                          Счёт
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-fg-muted">
                          Пришло
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-fg-muted">
                          Ушло
                        </th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase text-fg-muted">
                          Остаток
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {!report || report.accounts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-12 text-center text-fg-subtle">
                            <Wallet size={36} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Счетов пока нет</p>
                            <Link
                              href="/settings/money-accounts"
                              className="mt-1 inline-block text-xs text-accent hover:underline"
                            >
                              Завести наличные, карту, расчётный счёт
                            </Link>
                          </td>
                        </tr>
                      ) : (
                        <>
                          {report.accounts.map((a) => (
                            <tr key={a.id} className="hover:bg-surface-hover">
                              <td className="px-5 py-3">
                                <span className="font-medium text-fg">{a.name}</span>
                                {accountKindHint(a.name, a.kind) && (
                                  <span className="ml-2 text-xs text-fg-subtle">
                                    {accountKindHint(a.name, a.kind)}
                                  </span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                                {a.income ? formatCurrency(a.income) : "—"}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">
                                {a.expense ? formatCurrency(a.expense) : "—"}
                              </td>
                              <td className="whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums text-fg">
                                {formatCurrency(a.balance)}
                              </td>
                            </tr>
                          ))}
                          {(report.unassigned.income > 0 || report.unassigned.expense > 0) && (
                            <tr className="hover:bg-surface-hover">
                              <td className="px-5 py-3 text-fg-muted">
                                Без счёта
                                <span className="ml-2 text-xs text-fg-subtle">
                                  не указано, куда пришло
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                                {report.unassigned.income
                                  ? formatCurrency(report.unassigned.income)
                                  : "—"}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">
                                {report.unassigned.expense
                                  ? formatCurrency(report.unassigned.expense)
                                  : "—"}
                              </td>
                              <td className="px-5 py-3 text-right text-fg-subtle">—</td>
                            </tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* На что ушло */}
            <Card padding="md" className="h-full">
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-fg">
                <Receipt size={16} className="text-accent" /> На что ушло
              </h2>
              {!report || report.expensesByCategory.length === 0 ? (
                <div className="py-10 text-center text-fg-subtle">
                  <Receipt size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Расходов за период нет</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {report.expensesByCategory.map((c) => {
                    const max = report.expensesByCategory[0]?.amount || 1;
                    const pct = (c.amount / max) * 100;
                    const share = totals?.expense ? (c.amount / totals.expense) * 100 : 0;
                    return (
                      <div key={c.id ?? "none"}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="truncate pr-2 font-medium text-fg-muted">{c.name}</span>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs text-fg-subtle">{share.toFixed(0)}%</span>
                            <span className="font-semibold tabular-nums text-fg">
                              {formatCurrency(c.amount)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: "#f43f5e" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Журнал */}
          <Card padding="none">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
              <h2 className="flex items-center gap-2 font-semibold text-fg">
                <Receipt size={16} className="text-accent" /> Журнал
              </h2>
              <div className="flex rounded-lg border border-line bg-surface p-0.5">
                {(["expense", "income"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      tab === t ? "bg-accent-soft text-accent-fg" : "text-fg-muted hover:text-fg"
                    }`}
                  >
                    {t === "expense"
                      ? `Расход (${expenses.length})`
                      : `Приход (${payments.length})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-soft bg-surface-sunken">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase text-fg-muted">
                      Дата
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-fg-muted">
                      {tab === "expense" ? "Статья" : "От кого"}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-fg-muted">
                      Счёт
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-fg-muted">
                      Комментарий
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-fg-muted">
                      Сумма
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {tab === "expense" ? (
                    expenses.length === 0 ? (
                      <EmptyRow text="За этот период расходов нет" />
                    ) : (
                      expenses.map((e) => (
                        <tr key={e.id} className="group hover:bg-surface-hover">
                          <td className="whitespace-nowrap px-5 py-3 text-fg-muted">
                            {day(e.date)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-fg">
                              {e.category?.name ?? "Без статьи"}
                            </span>
                            {e.supplier && (
                              <p className="text-xs text-fg-subtle">{e.supplier.name}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-fg-muted">
                            {e.account?.name ?? <span className="text-fg-subtle">не указан</span>}
                          </td>
                          <td className="px-4 py-3 text-fg-muted">
                            {e.comment || "—"}
                            {e.order && (
                              <span className="ml-1.5 text-xs text-fg-subtle">
                                заявка {e.order.number}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-rose-600 dark:text-rose-400">
                            −{formatCurrency(e.amount)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => removeExpense(e.id)}
                              title="Удалить"
                              className="rounded p-1.5 text-fg-subtle opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )
                  ) : payments.length === 0 ? (
                    <EmptyRow text="За этот период прихода нет" />
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="group hover:bg-surface-hover">
                        <td className="whitespace-nowrap px-5 py-3 text-fg-muted">{day(p.date)}</td>
                        <td className="px-4 py-3">
                          {p.client ? (
                            <Link
                              href={`/clients/${p.client.id}`}
                              className="font-medium text-fg hover:text-accent"
                            >
                              {p.client.name}
                            </Link>
                          ) : (
                            <span className="text-fg-subtle">Без клиента</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-fg-muted">
                          {p.account?.name ?? <span className="text-fg-subtle">не указан</span>}
                        </td>
                        <td className="px-4 py-3 text-fg-muted">
                          {p.comment || "—"}
                          {p.order && (
                            <span className="ml-1.5 text-xs text-fg-subtle">
                              заявка {p.order.number}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(p.amount)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {/* Оплату по заявке отменяют в самой заявке — иначе она
                              разойдётся с тем, сколько заявка считает оплаченным. */}
                          {!p.order && (
                            <button
                              onClick={() => removePayment(p.id)}
                              title="Удалить"
                              className="rounded p-1.5 text-fg-subtle opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {adding && (
        <EntryModal
          kind={adding}
          accounts={accounts}
          categories={categories}
          onClose={() => setAdding(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  color,
  valueClass = "text-fg",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  valueClass?: string;
}) {
  return (
    <Card padding="md" className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-fg-muted">{label}</p>
          <p
            className={`mt-1.5 text-[22px] font-semibold leading-none tracking-tight tabular-nums ${valueClass}`}
          >
            {value}
          </p>
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${color}`}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={6} className="px-5 py-12 text-center text-fg-subtle">
        <Receipt size={36} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">{text}</p>
      </td>
    </tr>
  );
}
