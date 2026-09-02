"use client";

import { useState } from "react";
import Torg12View from "./Torg12View";
import UpdView from "./UpdView";
import Link from "next/link";
import Image from "next/image";
import { formatCurrency, formatDate, legalName } from "@/lib/utils";
import { numberToWords } from "@/lib/invoice-pdf";
import Button from "@/components/ui/Button";
import { useLineItems } from "@/hooks/useLineItems";
import { ArrowLeft, Download, Printer, Pencil, Check, X, FileText } from "lucide-react";

interface WaybillItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
}

export interface Party {
  name: string;
  fullName: string | null;
  okpo: string | null;
  bankName: string | null;
  bankAccount: string | null;
  corrAccount: string | null;
  bankBik: string | null;
  inn: string | null;
  kpp: string | null;
  legalAddress: string | null;
  phone: string | null;
}

interface Props {
  logoUrl?: string | null;
  waybill: {
    id: string;
    number: string;
    date: string;
    basis: string | null;
    total: number;
    client: Party;
    payer: Party | null;
    consignee: Party | null;
    invoice: { id: string; number: string; date: string } | null;
    order: { id: string; number: string } | null;
    items: WaybillItem[];
  };
  company: {
    name: string;
    inn: string;
    kpp: string;
    okpo?: string;
    worksWithVat?: boolean;
    defaultVatRate?: number;
    legalAddress: string;
    phone: string;
    bankName: string;
    bankAccount: string;
    bankBik: string;
    corrAccount: string;
    director: string;
    accountant: string;
  } | null;
}

function PartyBlock({ title, party }: { title: string; party: Party | null }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase text-gray-500">{title}</p>
      {party ? (
        <>
          <p className="font-semibold text-gray-900">{legalName(party)}</p>
          {party.inn && (
            <p className="mt-1 text-sm text-gray-600">
              ИНН: {party.inn}
              {party.kpp ? ` / КПП: ${party.kpp}` : ""}
            </p>
          )}
          {party.legalAddress && <p className="text-sm text-gray-600">{party.legalAddress}</p>}
          {party.phone && <p className="mt-1 text-sm text-gray-600">{party.phone}</p>}
        </>
      ) : (
        <p className="text-sm text-gray-400">—</p>
      )}
    </div>
  );
}

export default function WaybillPrintView({ waybill, company, logoUrl }: Props) {
  // Показываем только официальные бланки. Собственная простая форма
  // сохранена ниже и остаётся в коде: чтобы вернуть её, достаточно
  // добавить "simple" в переключатель и поставить начальным значением.
  const [form, setForm] = useState<"simple" | "torg12" | "upd">("torg12");
  const [downloading, setDownloading] = useState(false);
  // Основание можно поменять и после создания: заказчик нередко просит
  // сослаться на договор уже после того, как накладная выписана.
  const [basis, setBasis] = useState(waybill.basis ?? "");
  const [editingBasis, setEditingBasis] = useState(false);
  const [basisDraft, setBasisDraft] = useState("");
  const [savingBasis, setSavingBasis] = useState(false);

  async function saveBasis() {
    const next = basisDraft.trim();
    setSavingBasis(true);
    try {
      const res = await fetch(`/api/waybills/${waybill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basis: next || null }),
      });
      if (res.ok) {
        setBasis(next);
        setEditingBasis(false);
      }
    } finally {
      setSavingBasis(false);
    }
  }
  const {
    editing,
    editItems,
    saving,
    subtotal: editSubtotal,
    startEditing,
    cancelEditing,
    updateItem,
    addItem,
    removeItem,
    saveItems,
  } = useLineItems(waybill.items);

  // Плательщик и грузополучатель по умолчанию — контрагент накладной.
  const payer = waybill.payer ?? waybill.client;
  const consignee = waybill.consignee ?? waybill.client;
  const partiesDiffer = Boolean(
    waybill.payer && waybill.consignee && waybill.payer.name !== waybill.consignee.name,
  );

  const items = editing ? editItems : waybill.items;
  const total = editing ? editSubtotal : waybill.total;
  const totalQty = items.reduce((s, i) => s + Number(i.qty), 0);

  async function handleDownloadPDF() {
    setDownloading(true);
    try {
      const { generateWaybillPDF } = await import("@/lib/waybill-pdf");
      await generateWaybillPDF({ ...waybill, basis }, company);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/waybills" className="flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft size={14} /> Все накладные
          </Link>
          {waybill.invoice && (
            <Link
              href={`/invoices/${waybill.invoice.id}`}
              className="flex items-center gap-1.5 text-sm text-accent hover:underline"
            >
              <FileText size={14} /> Счёт {waybill.invoice.number}
            </Link>
          )}
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={cancelEditing}>
                <X size={16} /> Отмена
              </Button>
              <Button onClick={() => saveItems(`/api/waybills/${waybill.id}`)} loading={saving}>
                <Check size={16} /> Сохранить
              </Button>
            </>
          ) : (
            <>
              <div className="flex rounded-lg border border-line bg-surface p-0.5">
                {(["torg12", "upd"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setForm(f)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      form === f ? "bg-accent-soft text-accent-fg" : "text-fg-muted hover:text-fg"
                    }`}
                  >
                    {f === "torg12" ? "ТОРГ-12" : "УПД"}
                  </button>
                ))}
              </div>
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

      {form === "upd" ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white print:border-0">
          <UpdView
            waybill={waybill}
            company={company}
            basis={basis}
            items={items}
            total={total}
            worksWithVat={Boolean(company?.worksWithVat)}
            vatRate={Number(company?.defaultVatRate ?? 0)}
          />
        </div>
      ) : form === "torg12" ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white print:border-0">
          <Torg12View
            waybill={waybill}
            company={company}
            basis={basis}
            items={items}
            total={total}
            worksWithVat={Boolean(company?.worksWithVat)}
            vatRate={Number(company?.defaultVatRate ?? 0)}
          />
        </div>
      ) : (
      <div className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-white p-10 print:max-w-full print:border-0 print:p-0">
        {/* Заголовок */}
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-start gap-4">
            {logoUrl && (
              <Image src={logoUrl} alt="Логотип" width={80} height={48} className="object-contain" unoptimized />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ТОВАРНАЯ НАКЛАДНАЯ</h1>
              <p className="mt-1 text-lg font-medium text-gray-700">№ {waybill.number}</p>
              <p className="mt-0.5 text-sm text-gray-500">от {formatDate(waybill.date)}</p>
            </div>
          </div>
          <div className="max-w-xs text-right text-sm text-gray-500">
            {editingBasis ? (
              <div className="flex items-center gap-1 print:hidden">
                <input
                  value={basisDraft}
                  onChange={(e) => setBasisDraft(e.target.value)}
                  autoFocus
                  placeholder="Договор № … от …"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveBasis();
                    if (e.key === "Escape") setEditingBasis(false);
                  }}
                  className="w-56 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  onClick={saveBasis}
                  disabled={savingBasis}
                  title="Сохранить"
                  className="rounded p-1 text-green-600 hover:bg-green-50 disabled:opacity-50"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => setEditingBasis(false)}
                  title="Отмена"
                  className="rounded p-1 text-gray-500 hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="group flex items-center justify-end gap-1">
                {basis ? (
                  <span>
                    Основание: <span className="font-medium text-gray-700">{basis}</span>
                  </span>
                ) : (
                  <span className="text-gray-400 print:hidden">Основание не указано</span>
                )}
                <button
                  onClick={() => {
                    setBasisDraft(basis);
                    setEditingBasis(true);
                  }}
                  title="Изменить основание"
                  className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:text-accent group-hover:opacity-100 print:hidden"
                >
                  <Pencil size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Стороны */}
        <div className="mb-8 grid grid-cols-1 gap-8 rounded-lg bg-gray-50 p-5 sm:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Поставщик</p>
            <p className="font-semibold text-gray-900">{company?.name || "—"}</p>
            {company?.inn && (
              <p className="mt-1 text-sm text-gray-600">
                ИНН: {company.inn}
                {company.kpp ? ` / КПП: ${company.kpp}` : ""}
              </p>
            )}
            {company?.legalAddress && <p className="text-sm text-gray-600">{company.legalAddress}</p>}
            {company?.phone && <p className="mt-1 text-sm text-gray-600">{company.phone}</p>}
          </div>

          <PartyBlock title="Плательщик" party={payer} />
          <PartyBlock title="Грузополучатель" party={consignee} />
        </div>

        {partiesDiffer && (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 print:border-gray-300 print:bg-white print:text-gray-700">
            Плательщик и грузополучатель различаются: оплата — {legalName(payer)}, груз принимает — {legalName(consignee)}.
          </p>
        )}

        {/* Позиции */}
        <table className="mb-4 w-full text-sm">
          <thead>
            <tr className="border-y border-gray-300 bg-gray-50">
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700">№</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700">Наименование</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700">Кол-во</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700">Ед.</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700">Цена</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700">Сумма</th>
              {editing && <th className="w-8 print:hidden" />}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id ?? idx} className="border-b border-gray-100">
                <td className="px-2 py-2 text-gray-500">{idx + 1}</td>
                <td className="px-2 py-2 text-gray-900">
                  {editing ? (
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(idx, "name", e.target.value)}
                      className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  ) : (
                    item.name
                  )}
                </td>
                <td className="px-2 py-2 text-right text-gray-700">
                  {editing ? (
                    <input
                      type="number"
                      value={item.qty}
                      step="any"
                      onChange={(e) => updateItem(idx, "qty", e.target.value)}
                      className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  ) : (
                    Number(item.qty)
                  )}
                </td>
                <td className="px-2 py-2 text-gray-700">
                  {editing ? (
                    <input
                      value={item.unit}
                      onChange={(e) => updateItem(idx, "unit", e.target.value)}
                      className="w-16 rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  ) : (
                    item.unit
                  )}
                </td>
                <td className="px-2 py-2 text-right text-gray-700">
                  {editing ? (
                    <input
                      type="number"
                      value={item.price}
                      step="any"
                      onChange={(e) => updateItem(idx, "price", e.target.value)}
                      className="w-28 rounded border border-gray-200 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  ) : (
                    formatCurrency(Number(item.price))
                  )}
                </td>
                <td className="px-2 py-2 text-right font-medium text-gray-900">
                  {formatCurrency(Number(item.qty) * Number(item.price))}
                </td>
                {editing && (
                  <td className="px-1 py-2 print:hidden">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {editing && (
          <button
            type="button"
            onClick={addItem}
            className="mb-4 text-xs font-medium text-accent hover:underline print:hidden"
          >
            + Добавить строку
          </button>
        )}

        <div className="mb-8 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Всего позиций:</span>
              <span>{items.length}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Общее количество:</span>
              <span>{totalQty}</span>
            </div>
            <div className="flex justify-between border-t border-gray-300 pt-1 text-base font-bold text-gray-900">
              <span>Итого:</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <p className="mb-8 text-sm text-gray-700">
          Всего отпущено на сумму {formatCurrency(total)} ({numberToWords(total)})
        </p>

        {/* Подписи */}
        <div className="grid grid-cols-2 gap-8 border-t border-gray-300 pt-6">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Отпустил</p>
            <p className="text-sm text-gray-700">{company?.director || "____________________"}</p>
            <div className="mt-8 border-t border-gray-400 pt-1 text-xs text-gray-400">подпись</div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Груз принял</p>
            <p className="text-sm text-gray-700">{legalName(consignee) || "____________________"}</p>
            <div className="mt-8 border-t border-gray-400 pt-1 text-xs text-gray-400">подпись</div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
