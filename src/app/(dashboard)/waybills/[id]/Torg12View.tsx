"use client";

import { formatDate, legalName } from "@/lib/utils";
import { numberToWords } from "@/lib/invoice-pdf";
import type { Party } from "./WaybillPrintView";

interface WaybillItem {
  id?: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
}

interface Company {
  name: string;
  inn: string;
  kpp: string;
  okpo?: string;
  legalAddress: string;
  phone: string;
  bankName: string;
  bankAccount: string;
  bankBik: string;
  corrAccount: string;
  director: string;
  accountant: string;
}

/** Строка шапки: подпись слева, значение на подчёркивании, код в рамке справа. */
function HeadRow({
  label,
  value,
  code,
  codeLabel,
}: {
  label: string;
  value: string;
  code?: string;
  codeLabel?: string;
}) {
  return (
    <div className="flex items-end gap-2">
      <span className="shrink-0 text-[9px] text-gray-600">{label}</span>
      <span className="flex-1 border-b border-gray-500 px-1 text-[10px] leading-4">
        {value || " "}
      </span>
      {codeLabel && (
        <span className="shrink-0 text-[8px] text-gray-500">{codeLabel}</span>
      )}
      {codeLabel && (
        <span className="w-24 shrink-0 border border-gray-500 px-1 text-center text-[10px] leading-4">
          {code || " "}
        </span>
      )}
    </div>
  );
}

/**
 * Унифицированная форма ТОРГ-12 (Госкомстат № 132, ОКУД 0330212).
 *
 * Часть граф — упаковка, места, масса брутто/нетто, коды ОКЕИ — система
 * не хранит: это складские данные, которых в CRM печатного цеха нет.
 * Они выводятся прочерками и заполняются от руки, как обычно и делают.
 * Колонки НДС показываются только если компания работает с НДС.
 */
export default function Torg12View({
  waybill,
  company,
  basis,
  items,
  total,
  worksWithVat,
  vatRate,
}: {
  waybill: {
    number: string;
    date: string;
    client: Party;
    payer: Party | null;
    consignee: Party | null;
  };
  company: Company | null;
  basis: string;
  items: WaybillItem[];
  total: number;
  worksWithVat: boolean;
  vatRate: number;
}) {
  const payer = waybill.payer ?? waybill.client;
  const consignee = waybill.consignee ?? waybill.client;

  const orgLine = (p: Party | null) =>
    p
      ? [legalName(p), p.inn ? `ИНН ${p.inn}` : "", p.legalAddress].filter(Boolean).join(", ")
      : "";

  const companyLine = company
    ? [
        company.name,
        company.inn ? `ИНН ${company.inn}` : "",
        company.legalAddress,
        company.phone,
        company.bankAccount ? `р/с ${company.bankAccount}` : "",
        company.bankName,
        company.bankBik ? `БИК ${company.bankBik}` : "",
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const vatSum = worksWithVat ? (total * vatRate) / (100 + vatRate) : 0;
  const withoutVat = total - vatSum;
  const totalQty = items.reduce((s, i) => s + Number(i.qty), 0);

  const th =
    "border border-gray-600 px-1 py-0.5 text-center text-[8px] font-normal leading-tight align-middle";
  const td = "border border-gray-600 px-1 py-0.5 text-[9px] leading-tight";

  return (
    <div className="mx-auto w-full max-w-[1120px] bg-white p-6 text-gray-900 print:max-w-full print:p-0">
      {/* Товарный раздел ТОРГ-12 широкий — на портретной A4 обрезается. */}
      <style>{"@media print { @page { size: A4 landscape; margin: 8mm; } }"}</style>
      {/* Шапка */}
      <div className="mb-2 space-y-1">
        <HeadRow label="" value={companyLine} code={company?.okpo} codeLabel="Код по ОКПО" />
        <p className="pl-1 text-[8px] text-gray-500">
          организация-грузоотправитель, адрес, телефон, факс, банковские реквизиты
        </p>
        <HeadRow label="структурное подразделение" value="" />
        <HeadRow label="Грузополучатель" value={orgLine(consignee)} codeLabel="Код по ОКПО" code={consignee?.okpo ?? ""} />
        <HeadRow label="Поставщик" value={companyLine} codeLabel="Код по ОКПО" code={company?.okpo} />
        <HeadRow label="Плательщик" value={orgLine(payer)} codeLabel="Код по ОКПО" code={payer?.okpo ?? ""} />
        <HeadRow label="Основание" value={basis} />
        <p className="pl-1 text-[8px] text-gray-500">номер и дата договора, заказа-наряда</p>
      </div>

      {/* Номер и дата */}
      <div className="mb-1 flex justify-end">
        <table className="text-[9px]">
          <tbody>
            <tr>
              <td className="border border-gray-600 px-2 py-0.5 text-center">Номер документа</td>
              <td className="border border-gray-600 px-2 py-0.5 text-center">Дата составления</td>
            </tr>
            <tr>
              <td className="border border-gray-600 px-2 py-0.5 text-center font-semibold">
                {waybill.number}
              </td>
              <td className="border border-gray-600 px-2 py-0.5 text-center font-semibold">
                {formatDate(waybill.date)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h1 className="mb-2 text-center text-sm font-bold">ТОВАРНАЯ НАКЛАДНАЯ</h1>

      {/* Товарный раздел */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th rowSpan={2} className={th}>№ п/п</th>
              <th colSpan={3} className={th}>Товар</th>
              <th colSpan={2} className={th}>Единица измерения</th>
              <th rowSpan={2} className={th}>Вид упа-<br />ковки</th>
              <th colSpan={2} className={th}>Количество</th>
              <th rowSpan={2} className={th}>Масса брутто</th>
              <th rowSpan={2} className={th}>Количество (масса нетто)</th>
              <th rowSpan={2} className={th}>Цена, руб. коп.</th>
              <th rowSpan={2} className={th}>Сумма без учёта НДС, руб. коп.</th>
              {worksWithVat && <th colSpan={2} className={th}>НДС</th>}
              <th rowSpan={2} className={th}>Сумма с учётом НДС, руб. коп.</th>
            </tr>
            <tr>
              <th className={th}>наименование, характеристика, сорт, артикул</th>
              <th className={th}>код</th>
              <th className={th}>сорт</th>
              <th className={th}>наиме-<br />нование</th>
              <th className={th}>код по ОКЕИ</th>
              <th className={th}>в одном месте</th>
              <th className={th}>мест, штук</th>
              {worksWithVat && <th className={th}>ставка, %</th>}
              {worksWithVat && <th className={th}>сумма, руб. коп.</th>}
            </tr>
            <tr>
              {Array.from({ length: worksWithVat ? 16 : 14 }).map((_, i) => (
                <th key={i} className={th}>{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const lineTotal = Number(item.qty) * Number(item.price);
              const lineVat = worksWithVat ? (lineTotal * vatRate) / (100 + vatRate) : 0;
              return (
                <tr key={item.id ?? idx}>
                  <td className={`${td} text-center`}>{idx + 1}</td>
                  <td className={td}>{item.name}</td>
                  <td className={`${td} text-center`}>—</td>
                  <td className={`${td} text-center`}>—</td>
                  <td className={`${td} text-center`}>{item.unit}</td>
                  <td className={`${td} text-center`}>—</td>
                  <td className={`${td} text-center`}>—</td>
                  <td className={`${td} text-center`}>—</td>
                  <td className={`${td} text-center`}>—</td>
                  <td className={`${td} text-center`}>—</td>
                  <td className={`${td} text-right`}>{Number(item.qty)}</td>
                  <td className={`${td} text-right`}>{Number(item.price).toFixed(2)}</td>
                  <td className={`${td} text-right`}>{(lineTotal - lineVat).toFixed(2)}</td>
                  {worksWithVat && <td className={`${td} text-center`}>{vatRate}</td>}
                  {worksWithVat && <td className={`${td} text-right`}>{lineVat.toFixed(2)}</td>}
                  <td className={`${td} text-right font-semibold`}>{lineTotal.toFixed(2)}</td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={worksWithVat ? 12 : 10} className={`${td} text-right font-semibold`}>
                Итого
              </td>
              <td className={`${td} text-right`}>{totalQty}</td>
              <td className={`${td}`} />
              <td className={`${td} text-right`}>{withoutVat.toFixed(2)}</td>
              {worksWithVat && <td className={td} />}
              {worksWithVat && <td className={`${td} text-right`}>{vatSum.toFixed(2)}</td>}
              <td className={`${td} text-right font-bold`}>{total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Итоги прописью */}
      <div className="mt-3 space-y-1 text-[9px]">
        <p>
          Товарная накладная имеет приложение на <span className="px-6 underline">&nbsp;</span> листах
          и содержит <span className="px-6 underline">&nbsp;</span> порядковых номеров записей
        </p>
        <p>
          Всего мест <span className="px-8 underline">&nbsp;</span>
          Масса груза (нетто) <span className="px-8 underline">&nbsp;</span>
          Масса груза (брутто) <span className="px-8 underline">&nbsp;</span>
        </p>
        <p className="pt-1">
          Всего отпущено на сумму <span className="font-semibold">{numberToWords(total)}</span>
        </p>
      </div>

      {/* Подписи */}
      <div className="mt-6 grid grid-cols-2 gap-10 text-[9px]">
        <div className="space-y-4">
          <div>
            <p className="mb-3">Отпуск разрешил</p>
            <div className="flex items-end gap-2">
              <span className="w-28 shrink-0">Руководитель</span>
              <span className="flex-1 border-b border-gray-500">&nbsp;</span>
              <span className="w-40 border-b border-gray-500 text-center">
                {company?.director || " "}
              </span>
            </div>
            <div className="mt-0.5 flex gap-2 text-[7px] text-gray-500">
              <span className="w-28 shrink-0" />
              <span className="flex-1 text-center">подпись</span>
              <span className="w-40 text-center">расшифровка подписи</span>
            </div>
          </div>
          <div>
            <div className="flex items-end gap-2">
              <span className="w-28 shrink-0">Главный бухгалтер</span>
              <span className="flex-1 border-b border-gray-500">&nbsp;</span>
              <span className="w-40 border-b border-gray-500 text-center">
                {company?.accountant || " "}
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-end gap-2">
              <span className="w-28 shrink-0">Отпуск груза произвёл</span>
              <span className="flex-1 border-b border-gray-500">&nbsp;</span>
              <span className="w-40 border-b border-gray-500">&nbsp;</span>
            </div>
          </div>
          <p className="pt-3">М.П. &nbsp; «___» _________ 20___ г.</p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-3">
              По доверенности № <span className="px-8 underline">&nbsp;</span> от «___» ______ 20___ г.
            </p>
            <p>
              выданной <span className="px-16 underline">&nbsp;</span>
            </p>
          </div>
          <div>
            <div className="flex items-end gap-2">
              <span className="w-28 shrink-0">Груз принял</span>
              <span className="flex-1 border-b border-gray-500">&nbsp;</span>
              <span className="w-40 border-b border-gray-500">&nbsp;</span>
            </div>
          </div>
          <div>
            <div className="flex items-end gap-2">
              <span className="w-28 shrink-0">Груз получил</span>
              <span className="flex-1 border-b border-gray-500">&nbsp;</span>
              <span className="w-40 border-b border-gray-500 text-center">
                {legalName(consignee) || " "}
              </span>
            </div>
          </div>
          <p className="pt-3">М.П. &nbsp; «___» _________ 20___ г.</p>
        </div>
      </div>
    </div>
  );
}
