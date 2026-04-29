"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDate } from "@/lib/utils";
import { numberToWords } from "@/lib/invoice-pdf";
import Button from "@/components/ui/Button";
import { useLineItems } from "@/hooks/useLineItems";
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

function fmt(n: number) {
  return n.toLocaleString("ru", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateLong(d: string): string {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export default function InvoicePrintView({ invoice, company, logoUrl }: Props) {
  const [downloading, setDownloading] = useState(false);
  const { editing, editItems, saving, subtotal: editSubtotal, startEditing, cancelEditing, updateItem, addItem, removeItem, saveItems } =
    useLineItems(invoice.items);

  async function handleDownloadPDF() {
    setDownloading(true);
    try {
      const { generateInvoicePDF } = await import("@/lib/invoice-pdf");
      await generateInvoicePDF(invoice, company ? { ...company, phone: company.phone } : null);
    } finally { setDownloading(false); }
  }

  const editVat = (editSubtotal * invoice.vatRate) / 100;
  const editTotal = editSubtotal + editVat;

  const displayTotal = editing ? editTotal : invoice.total;
  const displaySubtotal = editing ? editSubtotal : invoice.subtotal;
  const displayVat = editing ? editVat : invoice.vatAmount;
  const displayItems = editing ? editItems : invoice.items;

  const supplierLine = [
    company?.name,
    company?.inn ? `ИНН ${company.inn}` : "",
    company?.legalAddress,
    company?.phone ? `тел.: ${company.phone}` : "",
    company?.bankAccount && company?.bankName ? `р/с ${company.bankAccount} в банке ${company.bankName}` : "",
    company?.bankBik ? `БИК ${company.bankBik}` : "",
  ].filter(Boolean).join(", ");

  const clientLine = [
    invoice.client.name,
    invoice.client.inn ? `ИНН ${invoice.client.inn}` : "",
    invoice.client.legalAddress,
  ].filter(Boolean).join(", ");

  return (
    <div className="p-6">
      {/* Controls — hidden on print */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href="/invoices" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Все счета
        </Link>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={cancelEditing}><X size={16} /> Отмена</Button>
              <Button onClick={() => saveItems(`/api/invoices/${invoice.id}`)} loading={saving}><Check size={16} /> Сохранить</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={startEditing}><Pencil size={16} /> Редактировать позиции</Button>
              <Button variant="outline" onClick={() => window.print()}><Printer size={16} /> Печать</Button>
              <Button onClick={handleDownloadPDF} loading={downloading}><Download size={16} /> Скачать PDF</Button>
            </>
          )}
        </div>
      </div>

      {/* Invoice document */}
      <div className="bg-white max-w-3xl mx-auto border border-gray-200 rounded-xl print:border-0 print:max-w-full print:rounded-none"
           style={{ fontFamily: "Arial, sans-serif", fontSize: "11px", color: "#000" }}>
        <div className="p-10 print:p-8">

          {/* Logo */}
          {logoUrl && (
            <div className="flex justify-end mb-3">
              <Image src={logoUrl} alt="Логотип" width={120} height={48} className="object-contain" unoptimized />
            </div>
          )}

          {/* Bank block */}
          <table className="w-full mb-4" style={{ borderCollapse: "collapse", fontSize: "10px" }}>
            <tbody>
              <tr>
                <td style={{ border: "1px solid #000", padding: "4px 6px", width: "55%" }}>
                  <div style={{ fontSize: "9px", color: "#555", marginBottom: "2px" }}>Банк получателя</div>
                  <strong>{company?.bankName}</strong>
                </td>
                <td style={{ border: "1px solid #000", padding: "4px 6px", width: "15%" }}>
                  <div style={{ fontSize: "9px", color: "#555" }}>БИК</div>
                  <strong>{company?.bankBik}</strong>
                </td>
                <td style={{ border: "1px solid #000", padding: "4px 6px", width: "30%" }}>
                  <div style={{ fontSize: "9px", color: "#555" }}>Сч. №</div>
                  <strong>{company?.corrAccount}</strong>
                </td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #000", padding: "4px 6px" }}>
                  <span style={{ fontSize: "9px", color: "#555" }}>ИНН </span>
                  <strong>{company?.inn}</strong>
                  <br />
                  <strong>{company?.name}</strong>
                  <div style={{ fontSize: "9px", color: "#555" }}>Получатель</div>
                </td>
                <td style={{ border: "1px solid #000", padding: "4px 6px", verticalAlign: "top" }}>
                  <div style={{ fontSize: "9px", color: "#555" }}>Сч. №</div>
                  <strong>{company?.bankAccount}</strong>
                </td>
                <td style={{ border: "1px solid #000", padding: "4px 6px" }}></td>
              </tr>
            </tbody>
          </table>

          {/* Title */}
          <h2 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 6px 0" }}>
            Счёт на оплату № {invoice.number} от {fmtDateLong(invoice.date)}
          </h2>
          <div style={{ borderTop: "3px solid #000", marginBottom: "2px" }} />
          <div style={{ borderTop: "1px solid #000", marginBottom: "10px" }} />

          {/* Parties */}
          <table className="w-full mb-3" style={{ borderCollapse: "collapse", fontSize: "10px" }}>
            <tbody>
              <tr>
                <td style={{ width: "110px", padding: "3px 0", color: "#555", verticalAlign: "top", whiteSpace: "nowrap" }}>Поставщик:</td>
                <td style={{ padding: "3px 8px", fontWeight: 600 }}>{supplierLine}</td>
              </tr>
              <tr>
                <td style={{ width: "110px", padding: "3px 0", color: "#555", whiteSpace: "nowrap" }}>Склад:</td>
                <td style={{ padding: "3px 8px" }}></td>
              </tr>
              <tr>
                <td style={{ width: "110px", padding: "3px 0", color: "#555", verticalAlign: "top", whiteSpace: "nowrap" }}>Заказчик:</td>
                <td style={{ padding: "3px 8px", fontWeight: 600 }}>{clientLine}</td>
              </tr>
              {invoice.basis && (
                <tr>
                  <td style={{ width: "110px", padding: "3px 0", color: "#555", verticalAlign: "top", whiteSpace: "nowrap" }}>Комментарий:</td>
                  <td style={{ padding: "3px 8px" }}>{invoice.basis}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Items table */}
          <table className="w-full mb-1" style={{ borderCollapse: "collapse", fontSize: "10px" }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center", width: "32px" }}>№ п/п</th>
                <th style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center", width: "36px" }}>Код</th>
                <th style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "left" }}>Наименование</th>
                <th style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "center", width: "72px" }}>Количество</th>
                <th style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "right", width: "72px" }}>Цена</th>
                <th style={{ border: "1px solid #000", padding: "5px 4px", textAlign: "right", width: "80px" }}>Сумма</th>
                {editing && <th style={{ border: "1px solid #000", padding: "5px 4px", width: "28px" }}></th>}
              </tr>
            </thead>
            <tbody>
              {editing ? (
                <>
                  {editItems.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "center" }}>{idx + 1}</td>
                      <td style={{ border: "1px solid #000", padding: "3px 4px" }}></td>
                      <td style={{ border: "1px solid #000", padding: "3px 4px" }}>
                        <input value={item.name} onChange={(e) => updateItem(idx, "name", e.target.value)}
                          className="w-full px-1 py-0.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-violet-500" />
                      </td>
                      <td style={{ border: "1px solid #000", padding: "3px 4px" }}>
                        <div className="flex gap-1">
                          <input type="number" min="0.01" step="any" value={item.qty}
                            onChange={(e) => updateItem(idx, "qty", parseFloat(e.target.value) || 0)}
                            className="w-12 px-1 py-0.5 text-xs border border-gray-200 rounded text-right focus:outline-none focus:ring-1 focus:ring-violet-500" />
                          <input value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)}
                            className="w-10 px-1 py-0.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-violet-500" />
                        </div>
                      </td>
                      <td style={{ border: "1px solid #000", padding: "3px 4px" }}>
                        <input type="number" min="0" step="any" value={item.price}
                          onChange={(e) => updateItem(idx, "price", parseFloat(e.target.value) || 0)}
                          className="w-full px-1 py-0.5 text-xs border border-gray-200 rounded text-right focus:outline-none focus:ring-1 focus:ring-violet-500" />
                      </td>
                      <td style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "right", fontWeight: 500 }}>
                        {fmt(Number(item.qty) * Number(item.price))}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "center" }}>
                        <button onClick={() => removeItem(idx)} disabled={editItems.length <= 1}
                          className="p-0.5 rounded hover:bg-red-50 text-red-400 disabled:opacity-30">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={7} style={{ border: "1px solid #000", padding: "4px 6px" }}>
                      <button onClick={addItem}
                        className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium">
                        <Plus size={12} /> Добавить позицию
                      </button>
                    </td>
                  </tr>
                </>
              ) : (
                invoice.items.map((item, idx) => (
                  <tr key={item.id}>
                    <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{idx + 1}</td>
                    <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}></td>
                    <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{item.name}</td>
                    <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{item.qty} {item.unit}</td>
                    <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right" }}>{fmt(item.price)}</td>
                    <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right", fontWeight: 600 }}>{fmt(item.total)}</td>
                  </tr>
                ))
              )}

              {/* Totals */}
              <tr>
                <td colSpan={editing ? 6 : 5} style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right", fontWeight: 700 }}>
                  {invoice.vatRate > 0 ? "Без НДС:" : "Итого:"}
                </td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right", fontWeight: 700 }}>
                  {fmt(displaySubtotal)}
                </td>
                {editing && <td style={{ border: "1px solid #000" }}></td>}
              </tr>
              {invoice.vatRate > 0 && (
                <>
                  <tr>
                    <td colSpan={editing ? 6 : 5} style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>
                      НДС {invoice.vatRate}%:
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right" }}>{fmt(displayVat)}</td>
                    {editing && <td style={{ border: "1px solid #000" }}></td>}
                  </tr>
                  <tr>
                    <td colSpan={editing ? 6 : 5} style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right", fontWeight: 700 }}>
                      Всего к оплате:
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px", textAlign: "right", fontWeight: 700 }}>{fmt(displayTotal)}</td>
                    {editing && <td style={{ border: "1px solid #000" }}></td>}
                  </tr>
                </>
              )}
            </tbody>
          </table>

          {/* Sum in words */}
          <p style={{ margin: "8px 0 2px 0", fontSize: "10px" }}>
            Всего наименований {displayItems.length}, на сумму{" "}
            <strong>{fmt(displayTotal)} сом</strong>
          </p>
          <p style={{ margin: "0 0 14px 0", fontSize: "10px", fontWeight: 700 }}>
            {numberToWords(displayTotal)}
          </p>

          {invoice.dueDate && (
            <p style={{ margin: "0 0 10px 0", fontSize: "10px" }}>
              Оплатить не позднее {fmtDateLong(invoice.dueDate)}
            </p>
          )}

          {/* Divider */}
          <div style={{ borderTop: "1px dashed #999", margin: "0 0 14px 0" }} />

          {/* Signatures */}
          <div className="flex gap-10">
            <div className="flex-1">
              <div className="flex items-end gap-3">
                <span style={{ fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" }}>Руководитель</span>
                <div className="flex-1">
                  <div style={{ borderBottom: "1px solid #000", height: "36px" }} />
                  <div style={{ fontSize: "10px", textAlign: "center", marginTop: "2px" }}>{company?.director || "_______________"}</div>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-end gap-3">
                <span style={{ fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" }}>Бухгалтер/менеджер</span>
                <div className="flex-1">
                  <div style={{ borderBottom: "1px solid #000", height: "36px" }} />
                  <div style={{ fontSize: "10px", textAlign: "center", marginTop: "2px" }}>{company?.accountant || "_______________"}</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Payment status badge — screen only */}
      <div className="max-w-3xl mx-auto mt-3 flex justify-end print:hidden">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${invoice.isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {invoice.isPaid ? "✓ Оплачен" : "Ожидает оплаты"}
        </span>
      </div>
    </div>
  );
}
