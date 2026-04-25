"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Search, FileText, CheckCircle, XCircle, Printer, Trash2 } from "lucide-react";

interface InvoiceItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
}

interface Invoice {
  id: string;
  number: string;
  clientId: string;
  orderId: string | null;
  date: string;
  dueDate: string | null;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  basis: string | null;
  isPaid: boolean;
  client: { id: string; name: string };
  order: { id: string; number: string } | null;
  items: InvoiceItem[];
}

interface Props {
  initialInvoices: Invoice[];
  clients: { id: string; name: string }[];
  orders: { id: string; number: string; client: { name: string } }[];
}

export default function InvoicesClient({ initialInvoices, clients, orders }: Props) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [search, setSearch] = useState("");
  const [paidFilter, setPaidFilter] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    orderId: "",
    number: "",
    vatRate: 0,
    basis: "",
    dueDate: "",
  });
  const [items, setItems] = useState<{ name: string; qty: number; unit: string; price: number }[]>([
    { name: "", qty: 1, unit: "шт", price: 0 },
  ]);

  const filtered = invoices.filter((i) => {
    const matchSearch =
      !search ||
      i.number.toLowerCase().includes(search.toLowerCase()) ||
      i.client.name.toLowerCase().includes(search.toLowerCase());
    const matchPaid = paidFilter === "" || (paidFilter === "paid" ? i.isPaid : !i.isPaid);
    return matchSearch && matchPaid;
  });

  const totalRevenue = filtered.reduce((sum, i) => sum + i.total, 0);
  const paidRevenue = filtered.filter((i) => i.isPaid).reduce((sum, i) => sum + i.total, 0);

  function addItem() {
    setItems([...items, { name: "", qty: 1, unit: "шт", price: 0 }]);
  }

  function updateItem(index: number, field: string, value: string | number) {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function removeItem(index: number) {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
  const vatAmount = (subtotal * form.vatRate) / 100;
  const total = subtotal + vatAmount;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId || items.some((i) => !i.name || i.price <= 0)) return;
    setLoading(true);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        number: form.number || undefined,
        orderId: form.orderId || undefined,
        dueDate: form.dueDate || undefined,
        items: items.filter((i) => i.name),
      }),
    });
    if (res.ok) {
      const created = await res.json();
      const client = clients.find((c) => c.id === form.clientId)!;
      setInvoices((prev) => [{ ...created, client, date: created.date, items: created.items || [] }, ...prev]);
      setModalOpen(false);
      setForm({ clientId: "", orderId: "", number: "", vatRate: 0, basis: "", dueDate: "" });
      setItems([{ name: "", qty: 1, unit: "шт", price: 0 }]);
    }
    setLoading(false);
  }

  async function togglePaid(id: string, isPaid: boolean) {
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid: !isPaid }),
    });
    if (res.ok) {
      setInvoices((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isPaid: !isPaid } : i))
      );
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Счета на оплату</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{filtered.length} счётов</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Выставить счёт
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card padding="sm">
          <p className="text-xs text-gray-500 dark:text-slate-500">Всего</p>
          <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{formatCurrency(totalRevenue)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-gray-500 dark:text-slate-500">Оплачено</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(paidRevenue)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-gray-500 dark:text-slate-500">Задолженность</p>
          <p className="text-xl font-bold text-red-700">{formatCurrency(totalRevenue - paidRevenue)}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Поиск по номеру или клиенту..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:text-slate-500 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <select
            value={paidFilter}
            onChange={(e) => setPaidFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none"
          >
            <option value="">Все</option>
            <option value="paid">Оплачены</option>
            <option value="unpaid">Не оплачены</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Счёт</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Клиент</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Дата</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Срок оплаты</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Сумма</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Статус</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400 dark:text-slate-500">
                  <FileText size={32} className="mx-auto mb-2 opacity-30" />
                  Счетов нет
                </td>
              </tr>
            ) : (
              filtered.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-medium text-gray-800 dark:text-slate-200">{invoice.number}</p>
                      {invoice.order && (
                        <Link href={`/orders/${invoice.order.id}`} className="text-xs text-violet-600 hover:underline">
                          {invoice.order.number}
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/clients/${invoice.client.id}`} className="text-sm text-gray-700 dark:text-slate-300 hover:text-violet-600">
                      {invoice.client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">{formatDate(invoice.date)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">{formatDate(invoice.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-slate-200">
                    {formatCurrency(invoice.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => togglePaid(invoice.id, invoice.isPaid)}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                        invoice.isPaid
                          ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60"
                          : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60"
                      }`}
                    >
                      {invoice.isPaid ? <CheckCircle size={11} /> : <XCircle size={11} />}
                      {invoice.isPaid ? "Оплачен" : "Не оплачен"}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/invoices/${invoice.id}`} className="text-xs text-violet-600 hover:underline">
                      PDF
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Новый счёт" size="xl">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Клиент *"
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              placeholder="Выберите клиента"
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              label="Привязать к заявке"
              value={form.orderId}
              onChange={(e) => setForm({ ...form, orderId: e.target.value })}
              placeholder="Выберите заявку (необязательно)"
              options={orders.map((o) => ({ value: o.id, label: `${o.number} · ${o.client.name}` }))}
            />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Input label="Номер счёта" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="авто" />
            <Input label="Срок оплаты" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            <Input label="НДС (%)" type="number" min={0} max={100} value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })} />
            <Input label="Основание" value={form.basis} onChange={(e) => setForm({ ...form, basis: e.target.value })} placeholder="Договор №..." />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Позиции *</label>
              <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                <Plus size={14} /> Добавить
              </Button>
            </div>
            <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-slate-500">Наименование</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 dark:text-slate-500 w-20">Кол-во</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-slate-500 w-16">Ед.</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 dark:text-slate-500 w-28">Цена</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 dark:text-slate-500 w-28">Итого</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1.5">
                        <input
                          value={item.name}
                          onChange={(e) => updateItem(idx, "name", e.target.value)}
                          placeholder="Наименование услуги"
                          className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min={0.001}
                          step={0.001}
                          value={item.qty}
                          onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
                          className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-slate-700 rounded text-right focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={item.unit}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min={0}
                          value={item.price}
                          onChange={(e) => updateItem(idx, "price", Number(e.target.value))}
                          className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-slate-700 rounded text-right focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs font-medium text-gray-700 dark:text-slate-300">
                        {formatCurrency(item.qty * item.price)}
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-gray-400 dark:text-slate-500 hover:text-red-500"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-700">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right text-xs text-gray-500 dark:text-slate-500">Подытог:</td>
                    <td className="px-3 py-2 text-right text-sm font-medium">{formatCurrency(subtotal)}</td>
                    <td></td>
                  </tr>
                  {form.vatRate > 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right text-xs text-gray-500 dark:text-slate-500">НДС {form.vatRate}%:</td>
                      <td className="px-3 py-2 text-right text-sm font-medium">{formatCurrency(vatAmount)}</td>
                      <td></td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">Итого:</td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-gray-900 dark:text-slate-100">{formatCurrency(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button type="submit" loading={loading} disabled={!form.clientId}>Выставить счёт</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
