"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatCurrency, formatDate } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { ArrowLeft, Download, Printer, Pencil, Plus, Trash2, Check, X } from "lucide-react";

interface InvoiceItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
}

interface Props {
  logoUrl?: string | null;
  invoice: {
    id: string;
    number: string;
    date: string;
    dueDate: string | null;
    vatRate: number;
    subtotal: number;
    vatAmount: number;
    total: number;
    basis: string | null;
    isPaid: boolean;
    client: {
      name: string;
      inn: string | null;
      kpp: string | null;
      legalAddress: string | null;
      bankName: string | null;
      bankAccount: string | null;
      bankBik: string | null;
    };
    items: InvoiceItem[];
  };
  company: {
    name: string;
    inn: string;
    kpp: string;
    legalAddress: string;
    phone: string;
    email: string;
    bankName: string;
    bankAccount: string;
    bankBik: string;
    corrAccount: string;
    director: string;
    accountant: string;
  } | null;
}

type EditItem = { id?: string; name: string; qty: number; unit: string; price: number };

export default function InvoicePrintView({ invoice, company, logoUrl }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setEditItems(invoice.items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, unit: i.unit, price: i.price })));
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditItems([]);
  }

  function updateItem(idx: number, field: keyof EditItem, value: string | number) {
    setEditItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function addItem() {
    setEditItems((prev) => [...prev, { name: "", qty: 1, unit: "шт", price: 0 }]);
  }

  function removeItem(idx: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveItems() {
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: editItems.map((i) => ({ ...i, qty: Number(i.qty), price: Number(i.price) })) }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPDF() {
    setDownloading(true);
    try {
      const { generateInvoicePDF } = await import("@/lib/invoice-pdf");
      await generateInvoicePDF(invoice, company);
    } finally {
      setDownloading(false);
    }
  }

  const editSubtotal = editItems.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0);
  const editVat = (editSubtotal * invoice.vatRate) / 100;
  const editTotal = editSubtotal + editVat;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href="/invoices" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Все счета
        </Link>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={cancelEditing}>
                <X size={16} /> Отмена
              </Button>
              <Button onClick={saveItems} loading={saving}>
                <Check size={16} /> Сохранить
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={startEditing}>
                <Pencil size={16} /> Редактировать позиции
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer size={16} /> Печать
              </Button>
              <Button onClick={handleDownloadPDF} loading={downloading}>
                <Download size={16} /> Скачать PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Print area */}
      <div ref={printRef} className="bg-white max-w-3xl mx-auto p-10 border border-gray-200 rounded-xl print:border-0 print:p-0 print:max-w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-4">
            {logoUrl && (
              <Image src={logoUrl} alt="Логотип" width={80} height={48} className="object-contain" unoptimized />
            )}
            <div>
            <h1 className="text-2xl font-bold text-gray-900">СЧЁТ НА ОПЛАТУ</h1>
            <p className="text-lg font-medium text-gray-700 mt-1">№ {invoice.number}</p>
            <p className="text-sm text-gray-500 mt-0.5">от {formatDate(invoice.date)}</p>
            </div>
          </div>
          <div className="text-right">
            {invoice.dueDate && (
              <p className="text-sm text-gray-500">
                Срок оплаты: <span className="font-medium text-gray-700">{formatDate(invoice.dueDate)}</span>
              </p>
            )}
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${invoice.isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {invoice.isPaid ? "✓ Оплачен" : "Ожидает оплаты"}
            </span>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-8 mb-8 p-5 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Поставщик</p>
            <p className="font-semibold text-gray-900">{company?.name || "—"}</p>
            <p className="text-sm text-gray-600 mt-1">ИНН: {company?.inn} / КПП: {company?.kpp}</p>
            <p className="text-sm text-gray-600">{company?.legalAddress}</p>
            <p className="text-sm text-gray-600 mt-1">Банк: {company?.bankName}</p>
            <p className="text-sm text-gray-600">Р/с: {company?.bankAccount}</p>
            <p className="text-sm text-gray-600">БИК: {company?.bankBik}</p>
            {company?.corrAccount && (
              <p className="text-sm text-gray-600">К/с: {company.corrAccount}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Покупатель</p>
            <p className="font-semibold text-gray-900">{invoice.client.name}</p>
            {invoice.client.inn && (
              <p className="text-sm text-gray-600 mt-1">
                ИНН: {invoice.client.inn}
                {invoice.client.kpp ? ` / КПП: ${invoice.client.kpp}` : ""}
              </p>
            )}
            {invoice.client.legalAddress && (
              <p className="text-sm text-gray-600">{invoice.client.legalAddress}</p>
            )}
            {invoice.client.bankName && (
              <>
                <p className="text-sm text-gray-600 mt-1">Банк: {invoice.client.bankName}</p>
                <p className="text-sm text-gray-600">Р/с: {invoice.client.bankAccount}</p>
                <p className="text-sm text-gray-600">БИК: {invoice.client.bankBik}</p>
              </>
            )}
          </div>
        </div>

        {invoice.basis && (
          <p className="text-sm text-gray-600 mb-4">Основание: {invoice.basis}</p>
        )}

        {/* Items table */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-700 uppercase">№</th>
              <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-700 uppercase">Наименование</th>
              <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-700 uppercase">Кол-во</th>
              <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-700 uppercase">Ед.</th>
              <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-700 uppercase">Цена</th>
              <th className="text-right py-2 text-xs font-semibold text-gray-700 uppercase">Сумма</th>
              {editing && <th className="py-2 w-8"></th>}
            </tr>
          </thead>
          <tbody>
            {editing ? (
              <>
                {editItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-1.5 pr-4 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={item.name}
                        onChange={(e) => updateItem(idx, "name", e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                        placeholder="Наименование"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.qty}
                        onChange={(e) => updateItem(idx, "qty", parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-sm border border-gray-200 rounded text-right focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={item.unit}
                        onChange={(e) => updateItem(idx, "unit", e.target.value)}
                        className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.price}
                        onChange={(e) => updateItem(idx, "price", parseFloat(e.target.value) || 0)}
                        className="w-28 px-2 py-1 text-sm border border-gray-200 rounded text-right focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </td>
                    <td className="py-1.5 text-right font-medium text-gray-700 pr-2">
                      {formatCurrency(Number(item.qty) * Number(item.price))}
                    </td>
                    <td className="py-1.5">
                      <button
                        onClick={() => removeItem(idx)}
                        disabled={editItems.length <= 1}
                        className="p-1 rounded hover:bg-red-50 text-red-400 disabled:opacity-30"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={7} className="pt-2">
                    <button
                      onClick={addItem}
                      className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium"
                    >
                      <Plus size={13} /> Добавить позицию
                    </button>
                  </td>
                </tr>
              </>
            ) : (
              invoice.items.map((item, idx) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-500">{idx + 1}</td>
                  <td className="py-2 pr-4 text-gray-800">{item.name}</td>
                  <td className="py-2 pr-4 text-right text-gray-800">{item.qty}</td>
                  <td className="py-2 pr-4 text-gray-800">{item.unit}</td>
                  <td className="py-2 pr-4 text-right text-gray-800">{formatCurrency(item.price)}</td>
                  <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(item.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-sm text-gray-600">Итого без НДС:</span>
              <span className="text-sm font-medium">{formatCurrency(editing ? editSubtotal : invoice.subtotal)}</span>
            </div>
            {invoice.vatRate > 0 && (
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-sm text-gray-600">НДС ({invoice.vatRate}%):</span>
                <span className="text-sm font-medium">{formatCurrency(editing ? editVat : invoice.vatAmount)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 mt-1">
              <span className="text-base font-bold text-gray-900">ИТОГО:</span>
              <span className="text-base font-bold text-gray-900">{formatCurrency(editing ? editTotal : invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-16 mt-12 pt-6 border-t border-gray-200">
          <div>
            <p className="text-xs text-gray-500 mb-6">Руководитель:</p>
            <div className="border-b border-gray-300 mb-1"></div>
            <p className="text-xs text-gray-600">{company?.director || "_______________"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-6">Бухгалтер:</p>
            <div className="border-b border-gray-300 mb-1"></div>
            <p className="text-xs text-gray-600">{company?.accountant || "_______________"}</p>
          </div>
        </div>
      </div>

    </div>
  );
}
