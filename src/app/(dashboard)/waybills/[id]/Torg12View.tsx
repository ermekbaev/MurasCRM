"use client";

import { legalName } from "@/lib/utils";
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
  directorTitle?: string;
  accountant: string;
}

/** Коды ОКЕИ для ходовых единиц. Неизвестные оставляем пустыми. */
const OKEI: Record<string, string> = {
  "шт": "796", "шт.": "796", "штука": "796",
  "компл": "839", "компл.": "839", "комплект": "839",
  "упак": "778", "упак.": "778", "уп": "778", "уп.": "778",
  "м": "006", "м.": "006", "метр": "006",
  "м2": "055", "кв.м": "055", "м²": "055",
  "м3": "113", "куб.м": "113", "м³": "113",
  "пог.м": "018", "пм": "018",
  "кг": "166", "л": "112",
  "час": "356", "ч": "356",
  "усл.ед": "876", "услуга": "876",
};

const b = "border border-black";
const cell = `${b} px-1 py-0.5 align-middle`;
const cap = "text-[6.5px] leading-tight text-gray-700";

/** Подчёркнутое поле с подписью снизу — основной приём этого бланка. */
function Field({
  value,
  caption,
  className = "",
}: {
  value?: string;
  caption?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="min-h-[12px] border-b border-black px-1 text-[8px] leading-[1.3]">
        {value || " "}
      </div>
      {caption && <div className={`${cap} text-center`}>{caption}</div>}
    </div>
  );
}

/**
 * Унифицированная форма № ТОРГ-12 (Госкомстат России, пост. от 25.12.98 № 132,
 * ОКУД 0330212). Свёрстана по образцу, предоставленному заказчиком.
 *
 * Графы, которых нет в CRM печатного цеха — код товара, вид упаковки, места,
 * масса брутто и нетто — остаются пустыми под заполнение от руки: это складские
 * данные, придумывать их нельзя. Колонки НДС присутствуют всегда, как в бланке;
 * при работе без НДС в них печатается «Без НДС».
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

  const fmt = (n: number) =>
    n.toLocaleString("ru", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /** Полная строка реквизитов, как в бланке: адрес, ИНН, счета, банк, телефон. */
  const companyLine = company
    ? [
        company.name,
        company.legalAddress,
        company.inn ? `ИНН ${company.inn}` : "",
        company.bankAccount ? `р/с ${company.bankAccount}` : "",
        company.bankName ? `банк ${company.bankName}` : "",
        company.corrAccount ? `к/с ${company.corrAccount}` : "",
        company.bankBik ? `БИК ${company.bankBik}` : "",
        company.phone ? `тел.: ${company.phone}` : "",
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const partyLine = (p: Party | null) =>
    p
      ? [
          legalName(p),
          p.legalAddress,
          p.inn ? `ИНН ${p.inn}` : "",
          p.bankAccount ? `р/с ${p.bankAccount}` : "",
          p.bankName ? `банк ${p.bankName}` : "",
          p.corrAccount ? `к/с ${p.corrAccount}` : "",
          p.bankBik ? `БИК ${p.bankBik}` : "",
        ]
          .filter(Boolean)
          .join(", ")
      : "";

  const vatSum = worksWithVat ? (total * vatRate) / (100 + vatRate) : 0;
  const withoutVat = total - vatSum;

  const dateShort = new Date(waybill.date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  const dateLong = new Date(waybill.date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  /** Блок стороны: подпись слева, реквизиты на линии, справа рамка «по ОКПО». */
  const PartyBlock = ({
    label,
    line,
    okpo,
    extra,
  }: {
    label: string;
    line: string;
    okpo?: string | null;
    extra?: React.ReactNode;
  }) => (
    <div className="flex items-start gap-2">
      <span className="w-[92px] shrink-0 pt-0.5 text-[8px]">{label}</span>
      <div className="flex-1">
        <div className="min-h-[22px] border-b border-black px-1 text-[8px] leading-[1.35]">
          {line || " "}
        </div>
        <div className={cap}>организация, адрес, телефон, факс, банковские реквизиты</div>
      </div>
      <div className="w-[160px] shrink-0 pt-0.5 text-right">
        {extra}
        <div className="flex items-center justify-end gap-1">
          <span className="text-[8px]">по ОКПО</span>
          <span className={`${b} h-[13px] w-[86px] px-1 text-[8px] leading-[13px]`}>
            {okpo || " "}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] bg-white p-5 text-black print:max-w-full print:p-0">
      {/* Широкий товарный раздел не помещается на портретную A4 */}
      <style>{"@media print { @page { size: A4 landscape; margin: 6mm; } }"}</style>

      {/* Отсылка к форме и ОКУД */}
      <div className="mb-1 flex justify-end">
        <div className="text-right">
          <p className="text-[7.5px]">Унифицированная форма № ТОРГ-12</p>
          <p className="text-[7.5px]">
            Утверждена постановлением Госкомстата России от 25.12.98 № 132
          </p>
          <table className="ml-auto mt-0.5 border-collapse text-[8px]">
            <tbody>
              <tr>
                <td className="px-1 text-right">&nbsp;</td>
                <td className={`${cell} w-[86px] text-center`}>Коды</td>
              </tr>
              <tr>
                <td className="px-1 text-right">Форма по ОКУД</td>
                <td className={`${cell} text-center font-bold`}>0330212</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Стороны */}
      <div className="space-y-0.5">
        <PartyBlock
          label="Грузоотправитель"
          line={companyLine}
          okpo={company?.okpo}
          extra={
            <div className="mb-0.5 flex items-center justify-end gap-1">
              <span className="text-[8px]">Вид деятельности по ОКДП</span>
              <span className={`${b} h-[13px] w-[86px]`}>&nbsp;</span>
            </div>
          }
        />
        <PartyBlock label="Грузополучатель" line={partyLine(consignee)} okpo={consignee?.okpo} />
        <PartyBlock label="Поставщик" line={companyLine} okpo={company?.okpo} />
        <PartyBlock label="Плательщик" line={partyLine(payer)} okpo={payer?.okpo} />

        <div className="flex items-start gap-2">
          <span className="w-[92px] shrink-0 pt-0.5 text-[8px]">Основание</span>
          <div className="flex-1">
            <div className="min-h-[14px] border-b border-black px-1 text-[8px] leading-[1.35]">
              {basis || " "}
            </div>
            <div className={cap}>договор, заказ-наряд</div>
          </div>
          <div className="w-[160px] shrink-0 text-right text-[8px]">
            <div className="flex items-center justify-end gap-1">
              <span>номер</span>
              <span className={`${b} h-[13px] w-[86px]`}>&nbsp;</span>
            </div>
            <div className="mt-0.5 flex items-center justify-end gap-1">
              <span>дата</span>
              <span className={`${b} h-[13px] w-[86px]`}>&nbsp;</span>
            </div>
          </div>
        </div>
      </div>

      {/* Заголовок с номером и датой */}
      <div className="my-2 flex items-start gap-4">
        <div className="flex flex-1 items-start justify-center gap-4">
          <h1 className="pt-3 text-[13px] font-bold">ТОВАРНАЯ НАКЛАДНАЯ</h1>
          <table className="border-collapse text-[8px]">
            <tbody>
              <tr>
                <td className={`${cell} w-[90px] text-center`}>Номер</td>
                <td className={`${cell} w-[110px] text-center`}>Дата составления</td>
              </tr>
              <tr>
                <td className={`${cell} text-center`}>{waybill.number}</td>
                <td className={`${cell} text-center`}>{dateShort}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="w-[230px] shrink-0 text-right text-[8px]">
          <div className="flex items-center justify-end gap-1">
            <span>Транспортная накладная</span>
            <span>номер</span>
            <span className={`${b} h-[13px] w-[70px]`}>&nbsp;</span>
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-1">
            <span>дата</span>
            <span className={`${b} h-[13px] w-[70px]`}>&nbsp;</span>
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-1">
            <span>Вид операции</span>
            <span className={`${b} h-[13px] w-[70px]`}>&nbsp;</span>
          </div>
        </div>
      </div>

      {/* Товарный раздел — 15 граф по бланку */}
      <table className="w-full border-collapse">
        <thead className="text-[7px] leading-tight">
          <tr>
            <th rowSpan={2} className={cell}>Номер по по-<br />рядку</th>
            <th colSpan={2} className={cell}>Товар</th>
            <th colSpan={2} className={cell}>Единица измерения</th>
            <th rowSpan={2} className={cell}>Вид упа-<br />ковки</th>
            <th colSpan={2} className={cell}>Количество</th>
            <th rowSpan={2} className={cell}>Масса брутто</th>
            <th rowSpan={2} className={cell}>Количество (масса нетто)</th>
            <th rowSpan={2} className={cell}>Цена, руб. коп.</th>
            <th rowSpan={2} className={cell}>Сумма без учета НДС, руб. коп.</th>
            <th colSpan={2} className={cell}>НДС</th>
            <th rowSpan={2} className={cell}>Сумма с учетом НДС, руб. коп.</th>
          </tr>
          <tr>
            <th className={cell}>наименование, характеристика, сорт, артикул товара</th>
            <th className={cell}>код</th>
            <th className={cell}>наимено-<br />вание</th>
            <th className={cell}>код по ОКЕИ</th>
            <th className={cell}>в одном месте</th>
            <th className={cell}>мест, штук</th>
            <th className={cell}>ставка, %</th>
            <th className={cell}>сумма, руб. коп.</th>
          </tr>
          <tr className="text-[7px]">
            {Array.from({ length: 15 }).map((_, i) => (
              <th key={i} className={`${cell} text-center font-normal`}>
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-[8px]">
          {items.map((item, idx) => {
            const lineTotal = Number(item.qty) * Number(item.price);
            const lineVat = worksWithVat ? (lineTotal * vatRate) / (100 + vatRate) : 0;
            return (
              <tr key={item.id ?? idx}>
                <td className={`${cell} text-center`}>{idx + 1}</td>
                <td className={cell}>{item.name}</td>
                <td className={`${cell} text-center`}>&nbsp;</td>
                <td className={`${cell} text-center`}>{item.unit}</td>
                <td className={`${cell} text-center`}>
                  {OKEI[item.unit.toLowerCase().trim()] ?? ""}
                </td>
                <td className={`${cell} text-center`}>&nbsp;</td>
                <td className={`${cell} text-center`}>&nbsp;</td>
                <td className={`${cell} text-center`}>&nbsp;</td>
                <td className={`${cell} text-center`}>&nbsp;</td>
                <td className={`${cell} text-right`}>{Number(item.qty)}</td>
                <td className={`${cell} text-right`}>{fmt(Number(item.price))}</td>
                <td className={`${cell} text-right`}>{fmt(lineTotal - lineVat)}</td>
                <td className={`${cell} text-center`}>
                  {worksWithVat ? `${vatRate}%` : "Без НДС"}
                </td>
                <td className={`${cell} text-right`}>{fmt(lineVat)}</td>
                <td className={`${cell} text-right`}>{fmt(lineTotal)}</td>
              </tr>
            );
          })}
          {(["Итого", "Всего по накладной"] as const).map((label) => (
            <tr key={label} className="text-[8px]">
              <td colSpan={9} className="px-1 py-0.5 text-right">
                {label}
              </td>
              <td className={`${cell} text-center`}>Х</td>
              <td className={`${cell} text-center`}>Х</td>
              <td className={`${cell} text-right font-semibold`}>{fmt(withoutVat)} ₽</td>
              <td className={`${cell} text-center`}>Х</td>
              <td className={`${cell} text-right font-semibold`}>{fmt(vatSum)} ₽</td>
              <td className={`${cell} text-right font-semibold`}>{fmt(total)} ₽</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Приложения, масса, доверенность */}
      <div className="mt-3 grid grid-cols-2 gap-8 text-[8px]">
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <span className="w-[150px] shrink-0 text-right">
              Товарная накладная имеет приложения и содержит
            </span>
            <Field className="w-40" caption="прописью" />
            <span className="shrink-0">порядковых номеров записей</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="w-[150px] shrink-0 text-right">Всего мест</span>
            <Field className="w-40" caption="прописью" />
          </div>
          <div className="flex items-end gap-2">
            <span className="w-[150px] shrink-0 text-right">
              Приложение (паспорта, сертификаты и т.п.) на
            </span>
            <Field className="w-28" caption="прописью" />
            <span className="shrink-0">листах</span>
          </div>
          <div>
            <p className="font-bold">Всего отпущено на сумму</p>
            <p className="font-bold">{numberToWords(total)}</p>
            <p className={cap}>прописью</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <span className="shrink-0">Масса груза (нетто)</span>
            <Field className="flex-1" caption="прописью" />
          </div>
          <div className="flex items-end gap-2">
            <span className="shrink-0">Масса груза (брутто)</span>
            <Field className="flex-1" caption="прописью" />
          </div>
          <div className="flex items-end gap-2 pt-2">
            <span className="shrink-0">По доверенности №</span>
            <Field className="w-32" />
            <span className="shrink-0">от</span>
            <Field className="flex-1" />
          </div>
          <div className="flex items-end gap-2">
            <span className="shrink-0">выданной</span>
            <Field
              className="flex-1"
              caption="кем, кому (организация, должность, фамилия, и.о.)"
            />
          </div>
        </div>
      </div>

      {/* Подписи */}
      <div className="mt-4 grid grid-cols-2 gap-8 text-[8px]">
        <div className="space-y-3">
          {[
            { role: "Отпуск разрешил", title: company?.directorTitle, name: company?.director },
            {
              role: "Главный (старший) бухгалтер",
              title: "",
              name: company?.accountant || company?.director,
            },
            { role: "Отпуск груза произвел", title: company?.directorTitle, name: company?.director },
          ].map((row, i) => (
            <div key={i} className="flex items-end gap-2">
              <span className="w-[110px] shrink-0">{row.role}</span>
              <Field className="w-28" value={row.title} caption="должность" />
              <Field className="flex-1" caption="подпись" />
              <Field className="w-40" value={row.name} caption="расшифровка подписи" />
            </div>
          ))}
          <p className="pt-2">М.П. &nbsp;&nbsp; {dateLong}</p>
        </div>

        <div className="space-y-3">
          {["Груз принял", "Груз получил грузополучатель"].map((role) => (
            <div key={role} className="flex items-end gap-2">
              <span className="w-[110px] shrink-0">{role}</span>
              <Field className="w-28" caption="должность" />
              <Field className="flex-1" caption="подпись" />
              <Field className="w-40" caption="расшифровка подписи" />
            </div>
          ))}
          <p className="pt-8">М.П. &nbsp;&nbsp; {dateLong}</p>
        </div>
      </div>
    </div>
  );
}
