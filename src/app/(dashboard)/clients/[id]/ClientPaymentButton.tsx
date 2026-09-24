"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { MoneyAccount } from "@/lib/money";

type Allocation = { number: string; pay: number; status: string };

export default function ClientPaymentButton({
  clientId,
  debt,
}: {
  clientId: string;
  debt: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(debt > 0 ? String(debt) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<
    { allocated: number; leftover: number; allocations: Allocation[] } | null
  >(null);

  // Куда пришли деньги. Без этого оплата не попадает в отчёт по картам и кассе.
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    if (!open || accounts.length > 0) return;
    fetch("/api/settings/money-accounts")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: MoneyAccount[]) => {
        const active = Array.isArray(d) ? d.filter((a) => a.isActive) : [];
        setAccounts(active);
        setAccountId((prev) => prev || active[0]?.id || "");
      })
      .catch(() => {});
  }, [open, accounts.length]);

  function close() {
    setOpen(false);
    setResult(null);
    setError("");
    setAmount(debt > 0 ? String(debt) : "");
  }

  async function submit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("Введите сумму больше 0");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch(`/api/clients/${clientId}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: value, accountId: accountId || null }),
    });
    setLoading(false);
    if (res.ok) {
      setResult(await res.json());
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Не удалось принять оплату");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={debt <= 0}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title={debt <= 0 ? "Нет задолженности" : "Принять оплату"}
      >
        <Banknote size={15} /> Принять оплату
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            className="bg-surface rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {!result ? (
              <>
                <h3 className="text-lg font-semibold text-fg mb-1">
                  Принять оплату
                </h3>
                <p className="text-sm text-fg-muted mb-4">
                  Долг клиента: <b>{formatCurrency(debt)}</b>. Сумма распределится по
                  заявкам от старых к новым.
                </p>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Сумма"
                  className="w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
                />
                {accounts.length > 0 && (
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="mt-3 w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
                  >
                    <option value="">Счёт не указан</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                <div className="flex gap-2 justify-end mt-5">
                  <button
                    onClick={close}
                    className="px-4 py-2 text-sm rounded-lg border border-line text-fg-muted"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={submit}
                    disabled={loading}
                    className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white disabled:opacity-50"
                  >
                    {loading ? "..." : "Принять"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-fg mb-2">
                  Оплата принята
                </h3>
                <p className="text-sm text-fg-muted mb-3">
                  Распределено: <b>{formatCurrency(result.allocated)}</b>
                  {result.leftover > 0 && (
                    <span className="text-orange-600">
                      {" "}
                      · переплата {formatCurrency(result.leftover)} записана как аванс
                    </span>
                  )}
                </p>
                <ul className="space-y-1 mb-5 text-sm">
                  {result.allocations.map((a) => (
                    <li key={a.number} className="flex justify-between">
                      <span className="text-fg-muted">{a.number}</span>
                      <span className="text-fg-muted">
                        {formatCurrency(a.pay)}{" "}
                        {a.status === "PAID" ? "· закрыта" : "· частично"}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end">
                  <button
                    onClick={close}
                    className="px-4 py-2 text-sm rounded-lg bg-accent text-on-accent"
                  >
                    Готово
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
