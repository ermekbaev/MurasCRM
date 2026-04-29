"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatCurrency, formatDate } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { useLineItems } from "@/hooks/useLineItems";
import { ArrowLeft, Download, Printer, Pencil, Plus, Trash2, Check, X } from "lucide-react";

interface ActItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
}

interface Props {
  logoUrl?: string | null;
  act: {
    id: string;
    number: string;
    date: string;
    total: number;
    items: ActItem[];
    invoice: {
      number: string;
      client: {
        name: string;
        inn: string | null;
        kpp: string | null;
        legalAddress: string | null;
      };
    } | null;
    order: { id: string; number: string } | null;
  };
  company: {
    name: string;
    inn: string;
    kpp: string;
    legalAddress: string;
    phone: string;
    director: string;
    accountant: string;
  } | null;
}

export default function ActPrintView({ act, company, logoUrl }: Props) {
  const [downloading, setDownloading] = useState(false);
  const { editing, editItems, saving, subtotal: editSubtotal, startEditing, cancelEditing, updateItem, addItem, removeItem, saveItems } =
    useLineItems(act.items);

  async function handleDownloadPDF() {
    setDownloading(true);
    try {
      const { generateActPDF } = await import("@/lib/act-pdf");
      await generateActPDF(act, company);
    } finally {
      setDownloading(false);
    }
  }
  const client = act.invoice?.client;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href="/acts" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Все акты
        </Link>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={cancelEditing}>
                <X size={16} /> Отмена
              </Button>
              <Button onClick={() => saveItems(`/api/acts/${act.id}`)} loading={saving}>
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

      <div
className="bg-white max-w-3xl mx-auto p-10 border border-gray-200 rounded-xl print:border-0 print:p-0 print:max-w-full"
      >
        {/* Заголовок */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-4">
            {logoUrl && (
              <Image src={logoUrl} alt="Логотип" width={80} height={48} className="object-contain" unoptimized />
            )}
            <div>
            <h1 className="text-2xl font-bold text-gray-900">АКТ ВЫПОЛНЕННЫХ РАБОТ</h1>
            <p className="text-lg font-medium text-gray-700 mt-1">№ {act.number}</p>
            <p className="text-sm text-gray-500 mt-0.5">от {formatDate(act.date)}</p>
            </div>
          </div>
          {act.invoice && (
            <div className="text-right text-sm text-gray-500">
              К счёту: <span className="font-medium text-gray-700">{act.invoice.number}</span>
            </div>
          )}
        </div>

        {/* Стороны */}
        <div className="grid grid-cols-2 gap-8 mb-8 p-5 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Исполнитель</p>
            <p className="font-semibold text-gray-900">{company?.name || "—"}</p>
            <p className="text-sm text-gray-600 mt-1">ИНН: {company?.inn} / КПП: {company?.kpp}</p>
            <p className="text-sm text-gray-600">{company?.legalAddress}</p>
            <p className="text-sm text-gray-600 mt-1">{company?.phone}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Заказчик</p>
            {client ? (
              <>
                <p className="font-semibold text-gray-900">{client.name}</p>
                {client.inn && (
                  <p className="text-sm text-gray-600 mt-1">
                    ИНН: {client.inn}{client.kpp ? ` / КПП: ${client.kpp}` : ""}
                  </p>
                )}
                {client.legalAddress && (
                  <p className="text-sm text-gray-600">{client.legalAddress}</p>
                )}
              </>
            ) : <p className="text-sm text-gray-500">—</p>}
          </div>
        </div>

        {/* Таблица позиций */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-700 uppercase w-8">№</th>
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
                        type="number" min="0.01" step="any" value={item.qty}
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
                        type="number" min="0" step="any" value={item.price}
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
              act.items.map((item, idx) => (
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

        {/* Итого */}
        <div className="flex justify-end mb-8">
          <div className="w-64">
            <div className="flex justify-between py-2 border-t-2 border-gray-300 mt-1">
              <span className="text-base font-bold text-gray-900">ИТОГО:</span>
              <span className="text-base font-bold text-gray-900">{formatCurrency(editing ? editSubtotal : act.total)}</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-700 mb-8">
          Вышеперечисленные работы выполнены в полном объёме, в установленные сроки.
          Заказчик претензий по объёму, качеству и срокам оказания услуг не имеет.
        </p>

        {/* Подписи */}
        <div className="grid grid-cols-2 gap-16 pt-6 border-t border-gray-200">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Исполнитель</p>
            <p className="text-sm text-gray-700 mb-6">{company?.name || ""}</p>
            <div className="border-b border-gray-300 mb-1"></div>
            <p className="text-xs text-gray-600">{company?.director || "_______________"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Заказчик</p>
            <p className="text-sm text-gray-700 mb-6">{client?.name || ""}</p>
            <div className="border-b border-gray-300 mb-1"></div>
            <p className="text-xs text-gray-600">_______________</p>
          </div>
        </div>
      </div>
    </div>
  );
}
