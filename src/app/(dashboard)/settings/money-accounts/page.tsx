"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Wallet, Edit3, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ACCOUNT_KIND_LABELS, type MoneyAccount } from "@/lib/money";

const KIND_OPTIONS = Object.entries(ACCOUNT_KIND_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const emptyForm = { name: "", kind: "CARD", startBalance: "0", isActive: true };

export default function MoneyAccountsPage() {
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MoneyAccount | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/money-accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(a: MoneyAccount) {
    setEditing(a);
    setForm({
      name: a.name,
      kind: a.kind,
      startBalance: String(a.startBalance),
      isActive: a.isActive,
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const url = editing
        ? `/api/settings/money-accounts/${editing.id}`
        : "/api/settings/money-accounts";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          kind: form.kind,
          startBalance: Number(form.startBalance) || 0,
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        setError("Не удалось сохранить счёт");
        return;
      }
      const saved: MoneyAccount = await res.json();
      setAccounts((prev) =>
        editing ? prev.map((a) => (a.id === saved.id ? saved : a)) : [...prev, saved],
      );
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a: MoneyAccount) {
    if (!confirm(`Удалить счёт «${a.name}»?`)) return;
    const res = await fetch(`/api/settings/money-accounts/${a.id}`, { method: "DELETE" });
    if (res.ok) {
      setAccounts((prev) => prev.filter((x) => x.id !== a.id));
      return;
    }
    const body = await res.json().catch(() => null);
    alert(body?.error ?? "Не удалось удалить счёт");
  }

  if (loading) return <div className="p-6 text-fg-subtle">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Wallet size={18} />}
        title="Счета и кассы"
        subtitle="Карты, наличные и расчётный счёт — куда приходят и откуда уходят деньги"
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Добавить счёт
          </Button>
        }
      />

      {accounts.length === 0 ? (
        <Card padding="md">
          <div className="py-12 text-center text-fg-subtle">
            <Wallet size={36} className="mx-auto mb-2 opacity-30" />
            <p>Счетов пока нет</p>
            <p className="mt-1 text-xs">
              Заведите те, которыми пользуетесь: «Наличные», «Карта Сбер», расчётный счёт
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-line-soft">
            {accounts.map((a) => (
              <div key={a.id} className="group flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-fg">{a.name}</span>
                    <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-fg-muted">
                      {ACCOUNT_KIND_LABELS[a.kind]}
                    </span>
                    {!a.isActive && (
                      <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-fg-muted">
                        Скрыт
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-fg-subtle">
                    Остаток на начало учёта: {formatCurrency(a.startBalance)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(a)}
                    title="Изменить"
                    className="rounded p-1.5 text-fg-muted hover:bg-surface-hover"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
                    title="Удалить"
                    className="rounded p-1.5 text-fg-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Редактировать счёт" : "Новый счёт"}
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <Input
            label="Название *"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Наличные, Карта Сбер, Расчётный счёт..."
          />

          <Select
            label="Тип"
            value={form.kind}
            onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value }))}
            options={KIND_OPTIONS}
          />

          <Input
            label="Остаток на начало учёта"
            type="number"
            step="0.01"
            value={form.startBalance}
            onChange={(e) => setForm((p) => ({ ...p, startBalance: e.target.value }))}
            hint="Сколько сейчас на этом счёте. Нужен, чтобы в отчёте был текущий остаток, а не только оборот."
          />

          <label className="flex items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="rounded border-line"
            />
            Доступен при записи прихода и расхода
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name.trim()}>
              {editing ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
