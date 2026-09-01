"use client";

import { legalName } from "@/lib/utils";
import type { Party } from "./WaybillPrintView";

interface UpdItem {
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
  legalAddress: string;
  phone: string;
  director: string;
  directorTitle?: string;
  accountant: string;
}

/** Коды ОКЕИ для ходовых единиц. */
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
const cap = "text-[6px] leading-tight text-gray-700";

/** Строка «подпись — значение на линии — номер графы справа». */
function Row({
  label,
  value,
  code,
  caption,
}: {
  label: string;
  value?: string;
  code: string;
  caption?: string;
}) {
  return (
    <div>
      <div className="flex items-end gap-1">
        <span className="shrink-0 text-[7.5px]">{label}</span>
        <span className="min-h-[11px] flex-1 border-b border-black px-1 text-[7.5px] leading-[1.3]">
          {value || " "}
        </span>
        <span className="w-7 shrink-0 text-right text-[7px]">({code})</span>
      </div>
      {caption && <p className={`${cap} pl-1`}>{caption}</p>}
    </div>
  );
}

/** Подпись: должность / подпись / ф.и.о. с номером графы. */
function SignRow({
  role,
  title,
  name,
  code,
}: {
  role: string;
  title?: string;
  name?: string;
  code: string;
}) {
  return (
    <div>
      <p className="text-[7.5px]">{role}</p>
      <div className="mt-2 flex items-end gap-2">
        <div className="w-28 shrink-0 text-center">
          <div className="border-b border-black text-[7.5px]">{title || " "}</div>
          <div className={cap}>(должность)</div>
        </div>
        <div className="w-24 shrink-0 text-center">
          <div className="h-3 border-b border-black" />
          <div className={cap}>(подпись)</div>
        </div>
        <div className="flex-1 text-center">
          <div className="border-b border-black text-[7.5px]">{name || " "}</div>
          <div className={cap}>(ф.и.о.)</div>
        </div>
        <span className="w-7 shrink-0 text-right text-[7px]">[{code}]</span>
      </div>
    </div>
  );
}

/**
 * Универсальный передаточный документ (форма рекомендована письмом ФНС
 * от 21.10.2013 № ММВ-20-3/96@, приложение № 1 к постановлению Правительства
 * от 26.12.2011 № 1137 в редакции от 16.08.2024 № 1096).
 * Свёрстан по образцу, предоставленному заказчиком.
 *
 * Статус выводится из настройки НДС: работаем с НДС — статус 1 (документ
 * заменяет счёт-фактуру), без НДС — статус 2 (только передаточный документ).
 * Графы, которых нет в CRM печатного цеха (код вида товара, акциз, страна
 * происхождения, номер декларации), печатаются прочерками.
 */
export default function UpdView({
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
    invoice: { number: string; date: string } | null;
  };
  company: Company | null;
  basis: string;
  items: UpdItem[];
  total: number;
  worksWithVat: boolean;
  vatRate: number;
}) {
  const buyer = waybill.payer ?? waybill.client;
  const consignee = waybill.consignee ?? waybill.client;

  const fmt = (n: number) =>
    n.toLocaleString("ru", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const status = worksWithVat ? "1" : "2";
  const vatSum = worksWithVat ? (total * vatRate) / (100 + vatRate) : 0;
  const withoutVat = total - vatSum;

  const dateLong = new Date(waybill.date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dateShort = new Date(waybill.date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  const sellerInnKpp = company ? `${company.inn}/${company.kpp}` : "";
  const buyerInnKpp = `${buyer?.inn ?? ""}/${buyer?.kpp ?? ""}`;

  return (
    <div className="mx-auto w-full max-w-[1400px] bg-white p-5 text-black print:max-w-full print:p-0">
      {/* Форма широкая — печатаем альбомно */}
      <style>{"@media print { @page { size: A4 landscape; margin: 6mm; } }"}</style>

      <div className="flex gap-3">
        {/* Левая колонка с названием документа и статусом */}
        <div className="w-[92px] shrink-0 text-[7.5px]">
          <p className="font-semibold leading-tight">
            Универсальный передаточный документ
          </p>
          <div className="mt-4 flex items-center gap-1">
            <span>Статус:</span>
            <span className={`${b} h-5 w-6 text-center text-[10px] font-bold leading-5`}>
              {status}
            </span>
          </div>
          <p className={`${cap} mt-3`}>
            1 – счет-фактура и передаточный документ (акт)
          </p>
          <p className={cap}>2 – передаточный документ (акт)</p>
        </div>

        <div className="min-w-0 flex-1">
          {/* Шапка: счёт-фактура и ссылка на постановление */}
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-0.5">
              <Row
                label="Счет-фактура №"
                value={`${waybill.number}   от   ${dateLong}`}
                code="1"
              />
              <Row label="Исправление №" value="--   от   --" code="1а" />
            </div>
            <p className="w-[46%] shrink-0 text-right text-[6.5px] leading-tight">
              Приложение № 1 к постановлению Правительства Российской Федерации
              от 26 декабря 2011 г. № 1137
              <br />
              (в редакции постановления Правительства Российской Федерации
              от 16 августа 2024 г. № 1096)
            </p>
          </div>

          {/* Стороны */}
          <div className="mt-2 grid grid-cols-2 gap-6">
            <div className="space-y-0.5">
              <Row label="Продавец:" value={company?.name} code="2" />
              <Row label="Адрес:" value={company?.legalAddress} code="2а" />
              <Row label="ИНН/КПП продавца:" value={sellerInnKpp} code="2б" />
              <Row label="Грузоотправитель и его адрес:" value="Он же" code="3" />
              <Row
                label="Грузополучатель и его адрес:"
                value={[legalName(consignee), consignee?.legalAddress].filter(Boolean).join(", ")}
                code="4"
              />
              <Row label="К платежно-расчетному документу №" value="" code="5" />
              <Row
                label="Документ об отгрузке"
                value={`Универсальный передаточный документ № ${waybill.number} от ${dateShort}`}
                code="5а"
              />
            </div>

            <div className="space-y-0.5">
              <Row label="Покупатель:" value={legalName(buyer)} code="6" />
              <Row label="Адрес:" value={buyer?.legalAddress ?? ""} code="6а" />
              <Row label="ИНН/КПП покупателя:" value={buyerInnKpp} code="6б" />
              <Row label="Валюта: наименование, код" value="Российский рубль, 643" code="7" />
              <Row
                label="Идентификатор государственного контракта, договора (соглашения) (при наличии):"
                value=""
                code="8"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Табличная часть */}
      <table className="mt-3 w-full border-collapse">
        <thead className="text-[6.5px] leading-tight">
          <tr>
            <th rowSpan={2} className={cell}>Код товара/ работ, услуг</th>
            <th rowSpan={2} className={cell}>№ п/п</th>
            <th rowSpan={2} className={cell}>
              Наименование товара (описание выполненных работ, оказанных услуг),
              имущественного права
            </th>
            <th rowSpan={2} className={cell}>Код вида товара</th>
            <th colSpan={2} className={cell}>Единица измерения</th>
            <th rowSpan={2} className={cell}>Количество (объем)</th>
            <th rowSpan={2} className={cell}>Цена (тариф) за единицу измерения</th>
            <th rowSpan={2} className={cell}>
              Стоимость товаров (работ, услуг), имущественных прав без налога – всего
            </th>
            <th rowSpan={2} className={cell}>В том числе сумма акциза</th>
            <th rowSpan={2} className={cell}>Налоговая ставка</th>
            <th rowSpan={2} className={cell}>Сумма налога, предъявляемая покупателю</th>
            <th rowSpan={2} className={cell}>
              Стоимость товаров (работ, услуг), имущественных прав с налогом – всего
            </th>
            <th colSpan={2} className={cell}>Страна происхождения товара</th>
            <th rowSpan={2} className={cell}>
              Регистрационный номер декларации на товары или регистрационный номер
              партии товара, подлежащего прослеживаемости
            </th>
          </tr>
          <tr>
            <th className={cell}>код</th>
            <th className={cell}>условное обозначение (национальное)</th>
            <th className={cell}>цифровой код</th>
            <th className={cell}>краткое наименование</th>
          </tr>
          <tr className="text-[6.5px]">
            {["А", "1", "1а", "1б", "2", "2а", "3", "4", "5", "6", "7", "8", "9", "10", "10а", "11"].map(
              (c) => (
                <th key={c} className={`${cell} text-center font-normal`}>
                  {c}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="text-[7.5px]">
          {items.map((item, idx) => {
            const lineTotal = Number(item.qty) * Number(item.price);
            const lineVat = worksWithVat ? (lineTotal * vatRate) / (100 + vatRate) : 0;
            return (
              <tr key={item.id ?? idx}>
                <td className={`${cell} text-center`}>&nbsp;</td>
                <td className={`${cell} text-center`}>{idx + 1}</td>
                <td className={cell}>{item.name}</td>
                <td className={`${cell} text-center`}>--</td>
                <td className={`${cell} text-center`}>
                  {OKEI[item.unit.toLowerCase().trim()] ?? ""}
                </td>
                <td className={`${cell} text-center`}>{item.unit}</td>
                <td className={`${cell} text-right`}>{Number(item.qty)}</td>
                <td className={`${cell} text-right`}>{fmt(Number(item.price))}</td>
                <td className={`${cell} text-right`}>{fmt(lineTotal - lineVat)}</td>
                <td className={`${cell} text-center`}>Без акциза</td>
                <td className={`${cell} text-center`}>
                  {worksWithVat ? `${vatRate}%` : "Без НДС"}
                </td>
                <td className={`${cell} text-right`}>{fmt(lineVat)}</td>
                <td className={`${cell} text-right`}>{fmt(lineTotal)}</td>
                <td className={`${cell} text-center`}>--</td>
                <td className={`${cell} text-center`}>--</td>
                <td className={`${cell} text-center`}>--</td>
              </tr>
            );
          })}
          <tr className="text-[7.5px] font-semibold">
            <td colSpan={8} className="px-1 py-0.5 text-right">
              Всего к оплате (9)
            </td>
            <td className={`${cell} text-right`}>{fmt(withoutVat)} ₽</td>
            <td className={`${cell} text-center`}>Х</td>
            <td className={`${cell} text-center`}>Х</td>
            <td className={`${cell} text-right`}>{fmt(vatSum)} ₽</td>
            <td className={`${cell} text-right`}>{fmt(total)} ₽</td>
            <td className={cell}>&nbsp;</td>
            <td className={cell}>&nbsp;</td>
            <td className={cell}>&nbsp;</td>
          </tr>
        </tbody>
      </table>

      {/* Подписи ответственных лиц */}
      <div className="mt-3 flex gap-6 text-[7.5px]">
        <div className="w-[110px] shrink-0">
          <p>Документ составлен на</p>
          <p className="font-semibold">1 листе</p>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-8">
          <div className="space-y-3">
            <SignRow
              role="Руководитель организации или иное уполномоченное лицо"
              title={company?.directorTitle}
              name={company?.director}
              code="—"
            />
            <SignRow
              role="Индивидуальный предприниматель или иное уполномоченное лицо"
              code="—"
            />
            <p className={cap}>
              (реквизиты свидетельства о государственной регистрации индивидуального
              предпринимателя)
            </p>
          </div>
          <div>
            <SignRow
              role="Главный бухгалтер или иное уполномоченное лицо"
              name={company?.accountant || company?.director}
              code="—"
            />
          </div>
        </div>
      </div>

      {/* Основание и транспортировка */}
      <div className="mt-3 space-y-1">
        <Row
          label="Основание передачи (сдачи) / получения (приемки)"
          value={
            basis ||
            (waybill.invoice
              ? `Счет на оплату № ${waybill.invoice.number}`
              : "")
          }
          code="8]"
          caption="(договор; доверенность и др.)"
        />
        <Row
          label="Данные о транспортировке и грузе"
          value=""
          code="9]"
          caption="(транспортная накладная, поручение экспедитору, экспедиторская / складская расписка и др. / масса нетто, брутто груза)"
        />
      </div>

      {/* Передача и приёмка */}
      <div className="mt-3 grid grid-cols-2 gap-8 text-[7.5px]">
        <div className="space-y-3 border-r border-gray-300 pr-6">
          <SignRow
            role="Товар (груз) передал / услуги, результаты работ, права сдал"
            title={company?.directorTitle}
            name={company?.director}
            code="10"
          />
          <div className="flex items-end gap-2">
            <span className="shrink-0">Дата отгрузки, передачи (сдачи)</span>
            <span className="flex-1 border-b border-black px-1">{dateLong}</span>
            <span className="w-7 shrink-0 text-right text-[7px]">[11]</span>
          </div>
          <div>
            <p>Иные сведения об отгрузке, передаче</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="h-3 flex-1 border-b border-black" />
              <span className="w-7 shrink-0 text-right text-[7px]">[12]</span>
            </div>
            <p className={cap}>
              (ссылки на неотъемлемые приложения, сопутствующие документы и т.п.)
            </p>
          </div>
          <SignRow
            role="Ответственный за правильность оформления факта хозяйственной жизни"
            title={company?.directorTitle}
            name={company?.director}
            code="13"
          />
          <div>
            <p>
              Наименование экономического субъекта – составителя документа
              (в т.ч. комиссионера / агента)
            </p>
            <div className="mt-1 flex items-end gap-2">
              <span className="flex-1 border-b border-black px-1 text-[7.5px]">
                {company ? `${company.name}, ${sellerInnKpp}` : " "}
              </span>
              <span className="w-7 shrink-0 text-right text-[7px]">[14]</span>
            </div>
            <p className={cap}>
              (может не заполняться при проставлении печати в М.П., может быть указан ИНН / КПП)
            </p>
          </div>
          <p className="pt-2">М.П.</p>
        </div>

        <div className="space-y-3">
          <SignRow
            role="Товар (груз) получил / услуги, результаты работ, права принял"
            code="15"
          />
          <div className="flex items-end gap-2">
            <span className="shrink-0">Дата получения (приемки)</span>
            <span className="flex-1 border-b border-black px-1">
              «____» __________ 20___ года
            </span>
            <span className="w-7 shrink-0 text-right text-[7px]">[16]</span>
          </div>
          <div>
            <p>Иные сведения о получении, приемке</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="h-3 flex-1 border-b border-black" />
              <span className="w-7 shrink-0 text-right text-[7px]">[17]</span>
            </div>
            <p className={cap}>
              (информация о наличии/отсутствии претензии; ссылки на приложения и другие документы)
            </p>
          </div>
          <SignRow
            role="Ответственный за правильность оформления факта хозяйственной жизни"
            code="18"
          />
          <div>
            <p>Наименование экономического субъекта – составителя документа</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="h-3 flex-1 border-b border-black" />
              <span className="w-7 shrink-0 text-right text-[7px]">[19]</span>
            </div>
            <p className={cap}>
              (может не заполняться при проставлении печати в М.П., может быть указан ИНН / КПП)
            </p>
          </div>
          <p className="pt-2">М.П.</p>
        </div>
      </div>
    </div>
  );
}
