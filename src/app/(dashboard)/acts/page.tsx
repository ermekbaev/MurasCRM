"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ClipboardList, Plus, Trash2, FileText, Pencil } from "lucide-react";
import Pagination from "@/components/ui/Pagination";

interface ActItem {
  name: string;
  qty: number;
  unit: string;
  price: number;
}

interface Act {
  id: string;
  number: string;
  date: string;
  total: number;
  invoice: { id: string; number: string; client: { id: string; name: string } } | null;
  order: { id: string; number: string } | null;
}

interface Invoice {
  id: string;
  number: string;
  client: { name: string };
  items: { name: string; qty: number; unit: string; price: number }[];
}

const EMPTY_ITEM: ActItem = { name: "", qty: 1, unit: "шт", price: 0 };

const ITEM_CLASS = "w-full px-2 py-1 text-sm border border-gray-200 dark:border-slate-700 rounded focus:ring-1 focus:ring-violet-500 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100";

function ItemsTable({
  items,
  onChange,
  onAdd,
  onRemove,
}: {
  items: ActItem[];
  onChange: (idx: number, field: keyof ActItem, value: string | number) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  const total = items.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Позиции</label>
        <button type="button" onClick={onAdd} className="text-xs text-violet-600 hover:text-violet-700 font-medium">
          + Добавить строку
        </button>
      </div>
      <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="text-left px-3 py-2 text-xs text-gray-500 dark:text-slate-400 font-medium">Наименование</th>
              <th className="text-right px-3 py-2 text-xs text-gray-500 dark:text-slate-400 font-medium w-16">Кол-во</th>
              <th className="text-left px-3 py-2 text-xs text-gray-500 dark:text-slate-400 font-medium w-16">Ед.</th>
              <th className="text-right px-3 py-2 text-xs text-gray-500 dark:text-slate-400 font-medium w-24">Цена</th>
              <th className="text-right px-3 py-2 text-xs text-gray-500 dark:text-slate-400 font-medium w-24">Сумма</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {items.map((item, idx) => (
              <tr key={idx}>
                <td className="px-2 py-1.5">
                  <input value={item.name} onChange={(e) => onChange(idx, "name", e.target.value)} required className={ITEM_CLASS} placeholder="Наименование" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" value={item.qty} onChange={(e) => onChange(idx, "qty", e.target.value)} min={0.01} step="any" required className={ITEM_CLASS + " text-right"} />
                </td>
                <td className="px-2 py-1.5">
                  <input value={item.unit} onChange={(e) => onChange(idx, "unit", e.target.value)} className={ITEM_CLASS} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" value={item.price} onChange={(e) => onChange(idx, "price", e.target.value)} min={0} step="any" required className={ITEM_CLASS + " text-right"} />
                </td>
                <td className="px-3 py-1.5 text-right text-sm font-medium text-gray-800 dark:text-slate-200">
                  {formatCurrency(Number(item.qty) * Number(item.price))}
                </td>
                <td className="px-1 py-1.5">
                  {items.length > 1 && (
                    <button type="button" onClick={() => onRemove(idx)} className="p-1 text-gray-400 dark:text-slate-500 hover:text-red-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end mt-2">
        <span className="text-sm font-bold text-gray-800 dark:text-slate-200">Итого: {formatCurrency(total)}</span>
      </div>
    </div>
  );
}

export default function ActsPage() {
  const [acts, setActs] = useState<Act[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [form, setForm] = useState({
    invoiceId: "",
    orderId: "",
    date: new Date().toISOString().split("T")[0],
    items: [{ ...EMPTY_ITEM }] as ActItem[],
  });

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Edit state
  const [editingAct, setEditingAct] = useState<Act | null>(null);
  const [editForm, setEditForm] = useState({ date: "", items: [{ ...EMPTY_ITEM }] as ActItem[] });
  const [editSaving, setEditSaving] = useState(false);

  const loadActs = useCallback(async (p = 1) => {
    setLoading(true);
    const data = await fetch(`/api/acts?page=${p}&limit=50`).then((r) => r.json());
    setActs(data.acts);
    setPage(data.page);
    setPages(data.pages);
    setTotal(data.total);
    setLoading(false);
  }, []);

  useEffect(() => { loadActs(1); }, [loadActs]);

  function openCreate() {
    fetch("/api/invoices?limit=100")
      .then((r) => r.json())
      .then((data) => setInvoices(data.invoices));
    setForm({
      invoiceId: "",
      orderId: "",
      date: new Date().toISOString().split("T")[0],
      items: [{ ...EMPTY_ITEM }],
    });
    setOpen(true);
  }

  async function openEdit(act: Act) {
    const data = await fetch(`/api/acts/${act.id}`).then((r) => r.json());
    setEditForm({
      date: data.date.split("T")[0],
      items: data.items.map((i: ActItem) => ({
        name: i.name,
        qty: Number(i.qty),
        unit: i.unit,
        price: Number(i.price),
      })),
    });
    setEditingAct(act);
  }

  function onInvoiceChange(invoiceId: string) {
    const inv = invoices.find((i) => i.id === invoiceId);
    setForm((f) => ({
      ...f,
      invoiceId,
      items: inv?.items.length
        ? inv.items.map((i) => ({ name: i.name, qty: Number(i.qty), unit: i.unit, price: Number(i.price) }))
        : [{ ...EMPTY_ITEM }],
    }));
  }

  function setItem(idx: number, field: keyof ActItem, value: string | number) {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }));
  }
  function addItem() { setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] })); }
  function removeItem(idx: number) { setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) })); }

  function setEditItem(idx: number, field: keyof ActItem, value: string | number) {
    setEditForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }));
  }
  function addEditItem() { setEditForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] })); }
  function removeEditItem(idx: number) { setEditForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) })); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/acts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: form.invoiceId || undefined,
        orderId: form.orderId || undefined,
        date: form.date,
        items: form.items.map((i) => ({ ...i, qty: Number(i.qty), price: Number(i.price) })),
      }),
    });
    if (res.ok) {
      await loadActs(1);
      setOpen(false);
    }
    setSaving(false);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAct) return;
    setEditSaving(true);
    const res = await fetch(`/api/acts/${editingAct.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: editForm.date,
        items: editForm.items.map((i) => ({ ...i, qty: Number(i.qty), price: Number(i.price) })),
      }),
    });
    if (res.ok) {
      await loadActs(page);
      setEditingAct(null);
    }
    setEditSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить акт?")) return;
    const res = await fetch(`/api/acts/${id}`, { method: "DELETE" });
    if (res.ok) loadActs(page);
  }

  if (loading) return <div className="p-6 text-gray-400 dark:text-slate-500">Загрузка...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <ClipboardList size={22} /> Акты выполненных работ
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{total} актов</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Создать акт
        </Button>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Акт</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Клиент</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Счёт</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Заявка</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Дата</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Сумма</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
              {acts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 dark:text-slate-500">
                    <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
                    Актов нет
                  </td>
                </tr>
              ) : (
                acts.map((act) => (
                  <tr key={act.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-slate-200">{act.number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">
                      {act.invoice?.client ? (
                        <Link href={`/clients/${act.invoice.client.id}`} className="hover:text-violet-600">
                          {act.invoice.client.name}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {act.invoice ? (
                        <Link href={`/invoices/${act.invoice.id}`} className="text-violet-600 hover:underline">
                          {act.invoice.number}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {act.order ? (
                        <Link href={`/orders/${act.order.id}`} className="text-violet-600 hover:underline">
                          {act.order.number}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">{formatDate(act.date)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-slate-200">
                      {formatCurrency(act.total)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/acts/${act.id}`}
                          className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                          title="Печать / PDF"
                        >
                          <FileText size={14} />
                        </Link>
                        <button
                          onClick={() => openEdit(act)}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
                          title="Редактировать"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(act.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Pagination page={page} pages={pages} total={total} limit={50} onPage={loadActs} loading={loading} />

      {/* Create modal */}
      <Modal isOpen={isOpen} onClose={() => setOpen(false)} title="Создать акт" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Счёт (необязательно)</label>
              <select
                value={form.invoiceId}
                onChange={(e) => onInvoiceChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
              >
                <option value="">— Без счёта —</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} — {inv.client.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Дата акта"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </div>
          <ItemsTable items={form.items} onChange={setItem} onAdd={addItem} onRemove={removeItem} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Отмена</Button>
            <Button type="submit" loading={saving}>Создать акт</Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editingAct} onClose={() => setEditingAct(null)} title={`Редактировать акт ${editingAct?.number ?? ""}`} size="lg">
        <form onSubmit={handleEditSave} className="space-y-4">
          <Input
            label="Дата акта"
            type="date"
            value={editForm.date}
            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
            required
          />
          <ItemsTable items={editForm.items} onChange={setEditItem} onAdd={addEditItem} onRemove={removeEditItem} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setEditingAct(null)}>Отмена</Button>
            <Button type="submit" loading={editSaving}>Сохранить</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
