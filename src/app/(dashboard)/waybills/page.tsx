"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Pagination from "@/components/ui/Pagination";
import DocumentItemsTable, {
  EMPTY_DOCUMENT_ITEM,
  type DocumentItem,
} from "@/components/documents/DocumentItemsTable";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileSpreadsheet, Plus, Trash2, FileText, Users } from "lucide-react";

interface Party {
  id: string;
  name: string;
}

interface Waybill {
  id: string;
  number: string;
  date: string;
  total: number;
  basis: string | null;
  client: Party;
  payer: Party | null;
  consignee: Party | null;
  invoice: { id: string; number: string; date: string } | null;
  order: { id: string; number: string } | null;
}

interface Invoice {
  id: string;
  number: string;
  date: string;
  client: { id: string; name: string };
  items: DocumentItem[];
}

const emptyForm = {
  invoiceId: "",
  clientId: "",
  payerId: "",
  consigneeId: "",
  companyId: "",
  number: "",
  basis: "",
  date: new Date().toISOString().split("T")[0],
  items: [{ ...EMPTY_DOCUMENT_ITEM }] as DocumentItem[],
};

export default function WaybillsPage() {
  const [waybills, setWaybills] = useState<Waybill[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Party[]>([]);
  const [companies, setCompanies] = useState<Party[]>([]);
  const [splitParties, setSplitParties] = useState(false);

  const [form, setForm] = useState(emptyForm);

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    const data = await fetch(`/api/waybills?page=${p}&limit=50`).then((r) => r.json());
    setWaybills(data.waybills ?? []);
    setPage(data.page ?? 1);
    setPages(data.pages ?? 1);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  function openCreate() {
    fetch("/api/invoices?limit=100")
      .then((r) => r.json())
      .then((data) => setInvoices(data.invoices ?? []));
    fetch("/api/clients?limit=200")
      .then((r) => r.json())
      .then((data) => setClients(Array.isArray(data) ? data : (data.clients ?? [])));
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => setCompanies(Array.isArray(data) ? data : []));

    setForm(emptyForm);
    setSplitParties(false);
    setError(null);
    setOpen(true);
  }

  /** Выбор счёта-основания подтягивает позиции, контрагента и текст основания. */
  function onInvoiceChange(invoiceId: string) {
    const inv = invoices.find((i) => i.id === invoiceId);
    setForm((f) => ({
      ...f,
      invoiceId,
      clientId: inv?.client.id ?? f.clientId,
      basis: inv ? `Счёт № ${inv.number} от ${formatDate(inv.date)}` : f.basis,
      items: inv?.items?.length
        ? inv.items.map((i) => ({
            name: i.name,
            qty: Number(i.qty),
            unit: i.unit,
            price: Number(i.price),
          }))
        : [{ ...EMPTY_DOCUMENT_ITEM }],
    }));
  }

  function setItem(idx: number, field: keyof DocumentItem, value: string | number) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    }));
  }
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_DOCUMENT_ITEM }] }));
  const removeItem = (idx: number) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId && !form.invoiceId) {
      setError("Выберите счёт-основание или контрагента");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/waybills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: form.invoiceId || undefined,
          clientId: form.clientId || undefined,
          payerId: splitParties ? form.payerId || undefined : undefined,
          consigneeId: splitParties ? form.consigneeId || undefined : undefined,
          companyId: form.companyId || undefined,
          number: form.number || undefined,
          basis: form.basis || undefined,
          date: form.date,
          items: form.items.map((i) => ({
            ...i,
            qty: Number(i.qty),
            price: Number(i.price),
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(typeof body?.error === "string" ? body.error : "Не удалось создать накладную");
        return;
      }
      await load(1);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить накладную?")) return;
    const res = await fetch(`/api/waybills/${id}`, { method: "DELETE" });
    if (res.ok) load(page);
  }

  if (loading) return <div className="p-6 text-fg-subtle">Загрузка...</div>;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        icon={<FileSpreadsheet size={18} />}
        title="Накладные"
        subtitle={`${total} накладных`}
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Создать накладную
          </Button>
        }
      />

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-soft bg-surface-sunken">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase text-fg-muted">Накладная</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-fg-muted">Плательщик</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-fg-muted">Грузополучатель</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-fg-muted">Основание</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-fg-muted">Сумма</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {waybills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-fg-subtle">
                    <FileSpreadsheet size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Накладных пока нет</p>
                  </td>
                </tr>
              ) : (
                waybills.map((w) => (
                  <tr key={w.id} className="group hover:bg-surface-hover">
                    <td className="px-5 py-3">
                      <Link href={`/waybills/${w.id}`} className="font-medium text-fg hover:text-accent">
                        {w.number}
                      </Link>
                      <p className="text-xs text-fg-subtle">{formatDate(w.date)}</p>
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {(w.payer ?? w.client).name}
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {(w.consignee ?? w.client).name}
                      {w.consignee && w.payer && w.consignee.id !== w.payer.id && (
                        <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-fg">
                          отличается
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {w.invoice ? (
                        <Link
                          href={`/invoices/${w.invoice.id}`}
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          <FileText size={12} /> {w.invoice.number}
                        </Link>
                      ) : (
                        <span className="text-xs text-fg-subtle">{w.basis || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-fg tabular-nums">
                      {formatCurrency(w.total)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDelete(w.id)}
                        title="Удалить"
                        className="rounded p-1.5 text-fg-subtle opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 pb-2">
          <Pagination page={page} pages={pages} total={total} limit={50} onPage={load} loading={loading} />
        </div>
      </Card>

      <Modal
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        title="Новая накладная"
        description="Формируется на основании счёта — позиции и реквизиты подтянутся автоматически"
        size="xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-fg-muted">Счёт-основание</label>
              <select
                value={form.invoiceId}
                onChange={(e) => onInvoiceChange(e.target.value)}
                className="h-9.5 rounded-lg border border-line bg-surface px-3 text-[13px] text-fg outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
              >
                <option value="">Без счёта</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.number} — {i.client.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-fg-muted">Контрагент</label>
              <select
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                className="h-9.5 rounded-lg border border-line bg-surface px-3 text-[13px] text-fg outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
              >
                <option value="">Из счёта</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <Input
              label="Номер накладной"
              value={form.number}
              onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
              placeholder="авто"
            />

            <Input
              label="Дата"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>

          <Input
            label="Основание"
            value={form.basis}
            onChange={(e) => setForm((f) => ({ ...f, basis: e.target.value }))}
            placeholder="Счёт № … от … или Договор № … от …"
            hint="По умолчанию подставляется выбранный счёт"
          />

          <div className="rounded-lg border border-line bg-surface-sunken p-3">
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <input
                type="checkbox"
                checked={splitParties}
                onChange={(e) => setSplitParties(e.target.checked)}
                className="rounded border-line"
              />
              <Users size={14} />
              Плательщик и грузополучатель различаются
            </label>

            {splitParties && (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-fg-muted">Плательщик</label>
                  <select
                    value={form.payerId}
                    onChange={(e) => setForm((f) => ({ ...f, payerId: e.target.value }))}
                    className="h-9.5 rounded-lg border border-line bg-surface px-3 text-[13px] text-fg outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
                  >
                    <option value="">Контрагент накладной</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-fg-muted">Грузополучатель</label>
                  <select
                    value={form.consigneeId}
                    onChange={(e) => setForm((f) => ({ ...f, consigneeId: e.target.value }))}
                    className="h-9.5 rounded-lg border border-line bg-surface px-3 text-[13px] text-fg outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
                  >
                    <option value="">Контрагент накладной</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {companies.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-fg-muted">Поставщик</label>
              <select
                value={form.companyId}
                onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
                className="h-9.5 rounded-lg border border-line bg-surface px-3 text-[13px] text-fg outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
              >
                <option value="">Основная компания</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <DocumentItemsTable
            items={form.items}
            onChange={setItem}
            onAdd={addItem}
            onRemove={removeItem}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" loading={saving}>
              Создать
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
