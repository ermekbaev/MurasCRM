"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/layout/PageHeader";
import Input from "@/components/ui/Input";
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
import { Wallet, Plus, Minus, Trash2, Settings } from "lucide-react";

type Tab = "income" | "expense";

function monthStart() {
  const n = new Date();
  return isoDate(new Date(n.getFullYear(), n.getMonth(), 1));
}

export default function MoneyPage() {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [tab, setTab] = useState<Tab>("expense");

  const [report, setReport] = useState<MoneyReport | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<Tab | null>(null);

  const load = useCallback(async () => {
    const period = `from=${from}&to=${to}`;
    const [r, p, e] = await Promise.all([
      fetch(`/api/money/report?${period}`).then((x) => (x.ok ? x.json() : null)),
      fetch(`/api/payments?${period}`).then((x) => (x.ok ? x.json() : null)),
      fetch(`/api/expenses?${period}`).then((x) => (x.ok ? x.json() : null)),
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

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Wallet size={18} />}
        title="Деньги"
        subtitle="Приход и расход по счетам — сколько и по какой карте прошло"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/settings/money-accounts"
              className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[13px] text-fg-muted hover:bg-surface-hover"
            >
              <Settings size={15} /> Счета
            </Link>
            <Button variant="outline" onClick={() => setAdding("income")}>
              <Plus size={16} /> Приход
            </Button>
            <Button onClick={() => setAdding("expense")}>
              <Minus size={16} /> Расход
            </Button>
          </div>
        }
      />

      {/* Период */}
      <Card padding="md">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="С" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="По" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button
            onClick={() => {
              setFrom(monthStart());
              setTo(isoDate(new Date()));
            }}
            className="h-9.5 rounded-lg border border-line px-3 text-[13px] text-fg-muted hover:bg-surface-hover"
          >
            Текущий месяц
          </button>
          <button
            onClick={() => {
              const n = new Date();
              setFrom(isoDate(new Date(n.getFullYear(), n.getMonth() - 1, 1)));
              setTo(isoDate(new Date(n.getFullYear(), n.getMonth(), 0)));
            }}
            className="h-9.5 rounded-lg border border-line px-3 text-[13px] text-fg-muted hover:bg-surface-hover"
          >
            Прошлый месяц
          </button>
        </div>
      </Card>

      {loading ? (
        <div className="p-6 text-fg-subtle">Загрузка...</div>
      ) : (
        <>
          {/* Итоги за период */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Summary label="Приход за период" value={report?.totals.income ?? 0} tone="green" />
            <Summary label="Расход за период" value={report?.totals.expense ?? 0} tone="red" />
            <Summary
              label="Разница"
              value={report?.totals.profit ?? 0}
              tone={(report?.totals.profit ?? 0) >= 0 ? "green" : "red"}
            />
          </div>

          {/* Счета */}
          <Card padding="none">
            <div className="border-b border-line-soft px-4 py-3">
              <h2 className="text-[13px] font-semibold text-fg">По счетам</h2>
              <p className="mt-0.5 text-xs text-fg-subtle">
                Обороты — за выбранный период, остаток — на сегодня
              </p>
            </div>
            {report && report.accounts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-line-soft text-left text-xs text-fg-subtle">
                      <th className="px-4 py-2 font-medium">Счёт</th>
                      <th className="px-4 py-2 text-right font-medium">Пришло</th>
                      <th className="px-4 py-2 text-right font-medium">Ушло</th>
                      <th className="px-4 py-2 text-right font-medium">Остаток</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {report.accounts.map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-fg">{a.name}</span>
                          {accountKindHint(a.name, a.kind) && (
                            <span className="ml-2 text-xs text-fg-subtle">
                              {accountKindHint(a.name, a.kind)}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-green-600 dark:text-green-400">
                          {a.income ? formatCurrency(a.income) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-red-600 dark:text-red-400">
                          {a.expense ? formatCurrency(a.expense) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-fg">
                          {formatCurrency(a.balance)}
                        </td>
                      </tr>
                    ))}
                    {(report.unassigned.income > 0 || report.unassigned.expense > 0) && (
                      <tr>
                        <td className="px-4 py-2.5 text-fg-muted">Без счёта</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-green-600 dark:text-green-400">
                          {report.unassigned.income
                            ? formatCurrency(report.unassigned.income)
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-red-600 dark:text-red-400">
                          {report.unassigned.expense
                            ? formatCurrency(report.unassigned.expense)
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-fg-subtle">—</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-fg-subtle">
                Счетов пока нет.{" "}
                <Link href="/settings/money-accounts" className="text-accent hover:underline">
                  Завести
                </Link>
              </div>
            )}
          </Card>

          {/* На что ушло */}
          {report && report.expensesByCategory.length > 0 && (
            <Card padding="none">
              <div className="border-b border-line-soft px-4 py-3">
                <h2 className="text-[13px] font-semibold text-fg">На что ушло</h2>
              </div>
              <div className="divide-y divide-line-soft">
                {report.expensesByCategory.map((c) => (
                  <div
                    key={c.id ?? "none"}
                    className="flex items-center justify-between px-4 py-2.5 text-[13px]"
                  >
                    <span className="text-fg">{c.name}</span>
                    <span className="font-medium text-fg">{formatCurrency(c.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Журнал */}
          <Card padding="none">
            <div className="flex border-b border-line-soft">
              {(["expense", "income"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={
                    "px-4 py-3 text-[13px] font-medium transition-colors " +
                    (tab === t
                      ? "border-b-2 border-accent text-fg"
                      : "text-fg-muted hover:text-fg")
                  }
                >
                  {t === "expense" ? `Расход (${expenses.length})` : `Приход (${payments.length})`}
                </button>
              ))}
            </div>

            {tab === "expense" ? (
              expenses.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-fg-subtle">
                  За этот период расходов нет
                </div>
              ) : (
                <div className="divide-y divide-line-soft">
                  {expenses.map((e) => (
                    <div key={e.id} className="group flex items-center gap-3 px-4 py-2.5">
                      <span className="w-20 shrink-0 text-xs text-fg-subtle">{day(e.date)}</span>
                      <div className="min-w-0 flex-1">
                        <span className="text-[13px] text-fg">
                          {e.category?.name ?? "Без статьи"}
                        </span>
                        {e.comment && (
                          <span className="ml-2 text-xs text-fg-muted">{e.comment}</span>
                        )}
                        <div className="text-xs text-fg-subtle">
                          {e.account?.name ?? "Счёт не указан"}
                          {e.order && ` · заявка ${e.order.number}`}
                        </div>
                      </div>
                      <span className="shrink-0 font-medium text-red-600 dark:text-red-400">
                        −{formatCurrency(e.amount)}
                      </span>
                      <button
                        onClick={() => removeExpense(e.id)}
                        title="Удалить"
                        className="rounded p-1.5 text-fg-subtle opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/30"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : payments.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-fg-subtle">
                За этот период прихода нет
              </div>
            ) : (
              <div className="divide-y divide-line-soft">
                {payments.map((p) => (
                  <div key={p.id} className="group flex items-center gap-3 px-4 py-2.5">
                    <span className="w-20 shrink-0 text-xs text-fg-subtle">{day(p.date)}</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-[13px] text-fg">
                        {p.client ? (
                          <Link href={`/clients/${p.client.id}`} className="hover:underline">
                            {p.client.name}
                          </Link>
                        ) : (
                          "Без клиента"
                        )}
                      </span>
                      {p.comment && <span className="ml-2 text-xs text-fg-muted">{p.comment}</span>}
                      <div className="text-xs text-fg-subtle">
                        {p.account?.name ?? "Счёт не указан"}
                        {p.order && ` · заявка ${p.order.number}`}
                      </div>
                    </div>
                    <span className="shrink-0 font-medium text-green-600 dark:text-green-400">
                      +{formatCurrency(p.amount)}
                    </span>
                    {/* Оплата по заявке отменяется в самой заявке — здесь только
                        то, что записали отдельно. */}
                    {p.order ? (
                      <span className="w-[30px] shrink-0" />
                    ) : (
                      <button
                        onClick={() => removePayment(p.id)}
                        title="Удалить"
                        className="rounded p-1.5 text-fg-subtle opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/30"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
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

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "red";
}) {
  return (
    <Card padding="md">
      <p className="text-xs text-fg-muted">{label}</p>
      <p
        className={
          "mt-1 text-xl font-semibold " +
          (tone === "green"
            ? "text-green-600 dark:text-green-400"
            : "text-red-600 dark:text-red-400")
        }
      >
        {formatCurrency(value)}
      </p>
    </Card>
  );
}
