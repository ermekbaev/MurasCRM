"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { isoDate } from "@/lib/money-period";
import type { ExpenseCategory, MoneyAccount } from "@/lib/money";

type Kind = "income" | "expense";

/**
 * Одна форма для прихода и расхода.
 *
 * Поля те же, что владелец ведёт в Экселе: дата, сумма, счёт и комментарий.
 * У расхода добавляется статья — без неё разбивка «на что ушло» не собирается.
 */
export default function EntryModal({
  kind,
  accounts,
  categories,
  onClose,
  onSaved,
}: {
  kind: Kind;
  accounts: MoneyAccount[];
  categories: ExpenseCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const active = accounts.filter((a) => a.isActive);
  const [date, setDate] = useState(isoDate(new Date()));
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(active[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExpense = kind === "expense";

  async function submit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("Введите сумму больше 0");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(isExpense ? "/api/expenses" : "/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Время берём текущее: в отчёте важен день, а не час.
          date: new Date(`${date}T12:00:00`).toISOString(),
          amount: value,
          accountId: accountId || null,
          ...(isExpense ? { categoryId: categoryId || null } : {}),
          comment: comment.trim(),
        }),
      });
      if (!res.ok) {
        setError(isExpense ? "Не удалось записать расход" : "Не удалось записать приход");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={isExpense ? "Новый расход" : "Новый приход"}>
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Дата" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input
            label="Сумма *"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <Select
          label={isExpense ? "Откуда оплатили" : "Куда пришли"}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={[
            { value: "", label: "Не указан" },
            ...active.map((a) => ({ value: a.id, label: a.name })),
          ]}
          hint={
            active.length === 0
              ? "Счетов пока нет — заведите их в настройках, иначе отчёт по картам не соберётся"
              : undefined
          }
        />

        {isExpense && (
          <Select
            label="Статья"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={[
              { value: "", label: "Без статьи" },
              ...categories
                .filter((c) => c.isActive)
                .map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        )}

        <Input
          label="Комментарий"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={isExpense ? "Плёнка, аренда за октябрь..." : "От кого и за что"}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit} loading={saving} disabled={!amount}>
            Записать
          </Button>
        </div>
      </div>
    </Modal>
  );
}
