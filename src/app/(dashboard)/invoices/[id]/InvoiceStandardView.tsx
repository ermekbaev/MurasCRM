"use client";

import Image from "next/image";
import { Plus, Trash2 } from "lucide-react";
import { legalName } from "@/lib/utils";
import { numberToWords } from "@/lib/invoice-pdf";
import type { LineItem } from "@/hooks/useLineItems";

interface InvoiceItem {
  id?: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
}

export interface InvoiceCompany {
  name: string;
  inn: string;
  kpp: string;
  legalAddress: string;
  phone: string;
  bankName: string;
  bankAccount: string;
  bankBik: string;
  corrAccount: string;
  director: string;
  directorTitle?: string;
  accountant: string;
  invoiceNotice?: string;
}

export interface InvoiceClient {
  name: string;
  fullName: string | null;
  inn: string | null;
  kpp: string | null;
  legalAddress: string | null;
}

const cell = "border border-black px-1.5 py-1 align-middle";

/**
 * Классическая форма «Счёт на оплату» — та, к которой привыкли бухгалтерии:
 * шапка с банковскими реквизитами в рамках, стороны, позиции, итоги справа,
 * подписи с печатью. Сделана по образцу заказчика.
 *
 * Прежняя форма Muras оставлена в InvoicePrintView и переключается кнопкой.
 */
export default function InvoiceStandardView({
  invoice,
  company,
  logoUrl,
  stampUrl,
  signatureUrl,
  items,
  editing,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
}: {
  invoice: {
    number: string;
    date: string;
    vatRate: number;
    client: InvoiceClient;
  };
  company: InvoiceCompany | null;
  logoUrl?: string | null;
  stampUrl?: string | null;
  signatureUrl?: string | null;
  items: InvoiceItem[];
  editing: boolean;
  onUpdateItem: (idx: number, field: keyof LineItem, value: string | number) => void;
  onAddItem: () => void;
  onRemoveItem: (idx: number) => void;
}) {
  const fmt = (n: number) =>
    n.toLocaleString("ru", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const dateLong = new Date(invoice.date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const subtotal = items.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0);
  const vat = (subtotal * invoice.vatRate) / 100;
  const total = subtotal + vat;

  const party = (
    name: string,
    inn?: string | null,
    kpp?: string | null,
    address?: string | null,
    phone?: string | null,
  ) =>
    [
      name,
      inn ? `ИНН ${inn}` : "",
      kpp ? `КПП ${kpp}` : "",
      address,
      phone ? `тел.: ${phone}` : "",
    ]
      .filter(Boolean)
      .join(", ");

  const supplier = company
    ? party(company.name, company.inn, company.kpp, company.legalAddress, company.phone)
    : "";
  const receiver = party(
    legalName(invoice.client),
    invoice.client.inn,
    invoice.client.kpp,
    invoice.client.legalAddress,
  );

  const inputCls =
    "w-full rounded border border-gray-300 px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <div
      className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white print:max-w-full print:rounded-none print:border-0"
      style={{ fontFamily: "Arial, sans-serif", color: "#000" }}
    >
      <div className="p-10 print:p-6">
        {/* Логотип и предупреждение об условиях оплаты */}
        <div className="mb-4 flex items-start gap-4">
          {logoUrl && (
            <Image
              src={logoUrl}
              alt="Логотип"
              width={110}
              height={56}
              className="shrink-0 object-contain"
              unoptimized
            />
          )}
          {company?.invoiceNotice && (
            <p className="text-[8.5px] leading-snug text-gray-700">{company.invoiceNotice}</p>
          )}
        </div>

        {/* Банковские реквизиты */}
        <table className="mb-5 w-full border-collapse text-[10px]">
          <tbody>
            <tr>
              <td className={cell} colSpan={2} rowSpan={2} style={{ width: "55%", verticalAlign: "top" }}>
                <div className="min-h-[34px] font-medium">{company?.bankName}</div>
                <div className="text-[8.5px] text-gray-600">Банк получателя</div>
              </td>
              <td className={cell} style={{ width: "12%" }}>БИК</td>
              <td className={cell}>{company?.bankBik}</td>
            </tr>
            <tr>
              <td className={cell}>Сч. №</td>
              <td className={cell}>{company?.corrAccount}</td>
            </tr>
            <tr>
              <td className={cell} style={{ width: "27%" }}>ИНН {company?.inn}</td>
              <td className={cell} style={{ width: "28%" }}>КПП {company?.kpp}</td>
              <td className={cell} rowSpan={2}>Сч. №</td>
              <td className={cell} rowSpan={2}>{company?.bankAccount}</td>
            </tr>
            <tr>
              <td className={cell} colSpan={2} style={{ verticalAlign: "top" }}>
                <div className="min-h-[30px] font-medium">{company?.name}</div>
                <div className="text-[8.5px] text-gray-600">Получатель</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Заголовок */}
        <h1 className="mb-4 text-[17px] font-bold">
          Счёт на оплату № {invoice.number} от {dateLong} года
        </h1>

        {/* Стороны */}
        <table className="mb-5 w-full text-[10px]">
          <tbody>
            <tr>
              <td className="w-[76px] py-1 align-top text-gray-600">Поставщик:</td>
              <td className="py-1 font-bold leading-snug">{supplier}</td>
            </tr>
            <tr>
              <td className="py-1 align-top text-gray-600">Получатель:</td>
              <td className="py-1 font-bold leading-snug">{receiver}</td>
            </tr>
          </tbody>
        </table>

        {/* Позиции */}
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="font-bold">
              <th className={`${cell} w-8 text-center`}>№</th>
              <th className={`${cell} text-center`}>Товары (работы, услуги)</th>
              <th className={`${cell} w-16 text-center`}>Кол-во</th>
              <th className={`${cell} w-12 text-center`}>Ед.</th>
              <th className={`${cell} w-20 text-center`}>Цена</th>
              <th className={`${cell} w-24 text-center`}>Сумма</th>
              {editing && <th className={`${cell} w-8 print:hidden`} />}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id ?? idx}>
                <td className={`${cell} text-center`}>{idx + 1}</td>
                <td className={cell}>
                  {editing ? (
                    <input
                      value={item.name}
                      onChange={(e) => onUpdateItem(idx, "name", e.target.value)}
                      className={inputCls}
                    />
                  ) : (
                    item.name
                  )}
                </td>
                <td className={`${cell} text-center`}>
                  {editing ? (
                    <input
                      type="number"
                      step="any"
                      value={item.qty}
                      onChange={(e) => onUpdateItem(idx, "qty", parseFloat(e.target.value) || 0)}
                      className={`${inputCls} text-right`}
                    />
                  ) : (
                    Number(item.qty)
                  )}
                </td>
                <td className={`${cell} text-center`}>
                  {editing ? (
                    <input
                      value={item.unit}
                      onChange={(e) => onUpdateItem(idx, "unit", e.target.value)}
                      className={inputCls}
                    />
                  ) : (
                    item.unit
                  )}
                </td>
                <td className={`${cell} text-right`}>
                  {editing ? (
                    <input
                      type="number"
                      step="any"
                      value={item.price}
                      onChange={(e) => onUpdateItem(idx, "price", parseFloat(e.target.value) || 0)}
                      className={`${inputCls} text-right`}
                    />
                  ) : (
                    fmt(Number(item.price))
                  )}
                </td>
                <td className={`${cell} text-right`}>
                  {fmt(Number(item.qty) * Number(item.price))}
                </td>
                {editing && (
                  <td className={`${cell} text-center print:hidden`}>
                    <button
                      onClick={() => onRemoveItem(idx)}
                      disabled={items.length <= 1}
                      className="rounded p-0.5 text-red-500 hover:bg-red-50 disabled:opacity-30"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {editing && (
          <button
            onClick={onAddItem}
            className="mt-2 flex items-center gap-1 text-[11px] font-medium text-accent hover:underline print:hidden"
          >
            <Plus size={12} /> Добавить позицию
          </button>
        )}

        {/* Итоги */}
        <table className="ml-auto mt-5 text-[11px]">
          <tbody>
            <tr>
              <td className="py-0.5 pr-6 text-right font-bold">Итого:</td>
              <td className="py-0.5 text-right font-bold">{fmt(subtotal)} ₽</td>
            </tr>
            <tr>
              <td className="py-0.5 pr-6 text-right font-bold">НДС:</td>
              <td className="py-0.5 text-right font-bold">
                {invoice.vatRate > 0 ? `${fmt(vat)} ₽` : "Без НДС"}
              </td>
            </tr>
            <tr>
              <td className="py-0.5 pr-6 text-right font-bold">Итого к оплате:</td>
              <td className="py-0.5 text-right font-bold">{fmt(total)} ₽</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-4 text-[10px]">
          Всего наименований {items.length}, на сумму {fmt(total)} ₽
        </p>
        <p className="mt-1 text-[10px] font-bold">{numberToWords(total)}</p>

        {/* Подписи */}
        <div className="relative mt-6 border-t border-black pt-5">
          {stampUrl && (
            <Image
              src={stampUrl}
              alt="Печать"
              width={130}
              height={130}
              unoptimized
              className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 object-contain opacity-80"
            />
          )}

          <div className="mb-5 flex items-end gap-3 text-[10px]">
            <span className="w-24 shrink-0 font-bold">Руководитель</span>
            <div className="w-44 shrink-0 text-center">
              <div className="border-b border-black pb-0.5 font-bold">
                {company?.directorTitle || " "}
              </div>
              <div className="text-[8px] text-gray-600">должность</div>
            </div>
            <div className="relative flex-1 text-center">
              <div className="relative border-b border-black">
                {signatureUrl && (
                  <Image
                    src={signatureUrl}
                    alt="Подпись"
                    width={110}
                    height={44}
                    unoptimized
                    className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 object-contain opacity-90"
                  />
                )}
                <div className="h-6" />
              </div>
              <div className="text-[8px] text-gray-600">подпись</div>
            </div>
            <div className="w-52 shrink-0 text-center">
              <div className="border-b border-black pb-0.5 font-bold">
                {company?.director || " "}
              </div>
              <div className="text-[8px] text-gray-600">расшифровка подписи</div>
            </div>
          </div>

          <div className="flex items-end gap-3 text-[10px]">
            <span className="w-24 shrink-0 font-bold">Бухгалтер</span>
            <div className="w-44 shrink-0" />
            <div className="flex-1 text-center">
              <div className="h-6 border-b border-black" />
              <div className="text-[8px] text-gray-600">подпись</div>
            </div>
            <div className="w-52 shrink-0 text-center">
              <div className="border-b border-black pb-0.5 font-bold">
                {company?.accountant || company?.director || " "}
              </div>
              <div className="text-[8px] text-gray-600">расшифровка подписи</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
