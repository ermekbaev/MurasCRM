"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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
      body: JSON.stringify({ amount: value }),
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
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {!result ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">
                  Принять оплату
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
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
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                <div className="flex gap-2 justify-end mt-5">
                  <button
                    onClick={close}
                    className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300"
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                  Оплата принята
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
                  Распределено: <b>{formatCurrency(result.allocated)}</b>
                  {result.leftover > 0 && (
                    <span className="text-orange-600">
                      {" "}
                      · переплата {formatCurrency(result.leftover)} не распределена
                    </span>
                  )}
                </p>
                <ul className="space-y-1 mb-5 text-sm">
                  {result.allocations.map((a) => (
                    <li key={a.number} className="flex justify-between">
                      <span className="text-gray-700 dark:text-slate-300">{a.number}</span>
                      <span className="text-gray-500 dark:text-slate-400">
                        {formatCurrency(a.pay)}{" "}
                        {a.status === "PAID" ? "· закрыта" : "· частично"}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end">
                  <button
                    onClick={close}
                    className="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white"
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
