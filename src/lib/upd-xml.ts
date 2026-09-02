import { randomUUID } from "crypto";
import { OKEI } from "@/lib/templateVars.server";

/**
 * Выгрузка УПД в XML формата ФНС 5.03 для загрузки в ЭДО.
 *
 * Формат утверждён приказом ФНС от 19.12.2023 № ЕД-7-26/970@ (в редакции от
 * 15.11.2024 № ЕД-7-26/1032@) и применяется с I квартала 2026 года. Схема
 * лежит в docs/formats — по ней файл и проверяется, гадать по печатной форме
 * тут нельзя: оператор отклоняет документ целиком при любом расхождении.
 *
 * Мы формируем только сам документ. Подписывает и отправляет его бухгалтер в
 * своём ЭДО: закрытый ключ КЭП лежит на токене и наружу не выдаётся.
 */

/** Кодировка жёстко задана форматом — не UTF-8. */
const ENCODING = "windows-1251";

const VERSION = "5.03";

/** Код формы по классификатору налоговых документов. */
const KND = "1115131";

const OPERATION_NAME =
  "Документ об отгрузке товаров (выполнении работ), передаче имущественных прав (документ об оказании услуг)";

export interface UpdParty {
  name: string;
  inn: string;
  kpp: string;
  address: string;
}

export interface UpdItem {
  name: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
}

export interface UpdInput {
  number: string;
  date: Date;
  /** Основание отгрузки: договор, счёт, спецификация. */
  basis: string;
  seller: UpdParty;
  buyer: UpdParty;
  /** Грузополучатель, если груз принимает не плательщик. */
  consignee: UpdParty | null;
  items: UpdItem[];
  /** Работает ли продавец с НДС: от этого зависит вид документа. */
  worksWithVat: boolean;
  vatRate: number;
  /** Подписант: кто передал товар. */
  signerName: string;
  signerTitle: string;
}

export interface UpdXml {
  fileName: string;
  /** Готовый файл в кодировке windows-1251. */
  buffer: Buffer;
}

/** XML-экранирование. Кавычки тоже — значения идут в атрибуты. */
function esc(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(value: number): string {
  return value.toFixed(2);
}

function qty(value: number): string {
  return value.toFixed(3);
}

function dateRu(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function timeRu(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  // Разделитель времени в формате — точка, а не двоеточие.
  return `${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`;
}

/**
 * ФИО одной строкой разбираем на части: схема требует их по отдельности.
 * Пустое место заполняем прочерком — так делают и типовые выгрузки, иначе
 * документ без подписанта не проходит проверку.
 */
function fio(full: string): { last: string; first: string; middle: string } {
  const parts = String(full ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    last: parts[0] || "-",
    first: parts[1] || "-",
    middle: parts.slice(2).join(" "),
  };
}

/**
 * Основание отгрузки схема хранит по частям: название, номер и дата. У нас это
 * одна строка, которую человек пишет как хочет — «Договор № 17 от 03.09.2026».
 * Разбираем что можем; номер обязателен, поэтому при его отсутствии ставим
 * «б/н», как принято в бумажных документах.
 */
function parseBasis(basis: string, fallbackDate: Date): {
  name: string;
  number: string;
  date: string;
} {
  const text = String(basis ?? "").trim();
  if (!text) return { name: "Договор", number: "б/н", date: dateRu(fallbackDate) };

  const numberMatch = text.match(/(?:№|N|#)\s*([^\s,;]+)/i);
  const dateMatch = text.match(/(\d{2}\.\d{2}\.\d{4})/);

  // Название — то, что осталось после номера и даты.
  const name = text
    .replace(numberMatch?.[0] ?? "", " ")
    .replace(/от\s*\d{2}\.\d{2}\.\d{4}/i, " ")
    .replace(dateMatch?.[0] ?? "", " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    name: name || "Договор",
    number: numberMatch?.[1] ?? "б/н",
    date: dateMatch?.[1] ?? dateRu(fallbackDate),
  };
}

/** Участник: реквизиты и адрес. */
function party(tag: string, p: UpdParty, extraAttrs = ""): string {
  const short = esc(p.name);
  const inn = esc(p.inn);
  const kpp = esc(p.kpp);

  // ИНН из 12 цифр — предприниматель, из 10 — организация. У предпринимателя
  // КПП не бывает, и схема его в этой ветке не примет.
  const isEntrepreneur = inn.replace(/\D/g, "").length === 12;
  const person = fio(p.name);

  const identity = isEntrepreneur
    ? `<СвИП ИННФЛ="${inn}"><ФИО Фамилия="${esc(person.last)}" Имя="${esc(person.first)}"${
        person.middle ? ` Отчество="${esc(person.middle)}"` : ""
      }/></СвИП>`
    : `<СвЮЛУч НаимОрг="${short}" ИННЮЛ="${inn}"${kpp ? ` КПП="${kpp}"` : ""}/>`;

  // Адрес отдаём информационной строкой: она разрешена форматом и не требует
  // разбора на индекс, регион, улицу и дом, которого у нас в карточке нет.
  const address = `<Адрес><АдрИнф КодСтр="643" НаимСтран="РОССИЯ" АдрТекст="${esc(
    p.address || "не указан",
  )}"/></Адрес>`;

  return `<${tag} СокрНаим="${short}"${extraAttrs}><ИдСв>${identity}</ИдСв>${address}</${tag}>`;
}

/**
 * Имя файла обмена задано форматом:
 * ON_NSCHFDOPPR_<идентификатор получателя>_<идентификатор отправителя>_<дата>_<GUID>
 * Идентификатор — ИНН и КПП слитно, у предпринимателя только ИНН.
 */
function participantId(p: UpdParty): string {
  const inn = p.inn.replace(/\D/g, "");
  const kpp = p.kpp.replace(/\D/g, "");
  return inn.length === 12 ? inn : `${inn}${kpp}`;
}

export function buildUpdXml(input: UpdInput): UpdXml {
  const now = new Date();
  const withVat = input.worksWithVat && input.vatRate > 0;

  // СЧФДОП — универсальный документ вместе со счётом-фактурой. ДОП — только
  // первичный документ: он и нужен на упрощёнке, где счёт-фактуру не выставляют.
  const func = withVat ? "СЧФДОП" : "ДОП";
  const rate = withVat ? `${String(input.vatRate).replace(".", ",")}%` : "без НДС";

  const rows = input.items.map((item, index) => {
    const total = item.total;
    // Цены в системе хранятся с НДС, поэтому налог выделяем из суммы.
    const vat = withVat ? (total * input.vatRate) / (100 + input.vatRate) : 0;
    const withoutVat = total - vat;
    const okei = OKEI[item.unit.toLowerCase().trim()];

    const tax = withVat
      ? `<СумНал><СумНал>${money(vat)}</СумНал></СумНал>`
      : `<СумНал><БезНДС>без НДС</БезНДС></СумНал>`;

    return (
      `<СведТов НомСтр="${index + 1}" НаимТов="${esc(item.name)}"` +
      (okei ? ` ОКЕИ_Тов="${okei}"` : "") +
      ` НаимЕдИзм="${esc(item.unit)}" КолТов="${qty(item.qty)}" ЦенаТов="${money(item.price)}"` +
      ` СтТовБезНДС="${money(withoutVat)}" НалСт="${rate}" СтТовУчНал="${money(total)}">` +
      `<Акциз><БезАкциз>без акциза</БезАкциз></Акциз>` +
      tax +
      `</СведТов>`
    );
  });

  const grandTotal = input.items.reduce((sum, i) => sum + i.total, 0);
  const grandVat = withVat ? (grandTotal * input.vatRate) / (100 + input.vatRate) : 0;
  const grandWithout = grandTotal - grandVat;

  const totals =
    `<ВсегоОпл СтТовБезНДСВсего="${money(grandWithout)}" СтТовУчНалВсего="${money(grandTotal)}">` +
    (withVat
      ? `<СумНалВсего><СумНал>${money(grandVat)}</СумНал></СумНалВсего>`
      : `<СумНалВсего><БезНДС>без НДС</БезНДС></СумНалВсего>`) +
    `</ВсегоОпл>`;

  const signer = fio(input.signerName);
  const signerFio =
    `<ФИО Фамилия="${esc(signer.last)}" Имя="${esc(signer.first)}"` +
    (signer.middle ? ` Отчество="${esc(signer.middle)}"` : "") +
    `/>`;

  const consignee = input.consignee ?? input.buyer;

  const fileId =
    `ON_NSCHFDOPPR_${participantId(input.buyer)}_${participantId(input.seller)}` +
    `_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}` +
    `_${randomUUID()}`;

  const xml =
    `<?xml version="1.0" encoding="${ENCODING}"?>` +
    `<Файл ИдФайл="${fileId}" ВерсФорм="${VERSION}" ВерсПрог="Muras CRM">` +
    `<Документ КНД="${KND}" Функция="${func}"` +
    ` ПоФактХЖ="${OPERATION_NAME}" НаимДокОпр="${OPERATION_NAME}"` +
    ` ДатаИнфПр="${dateRu(now)}" ВремИнфПр="${timeRu(now)}"` +
    ` НаимЭконСубСост="${esc(input.seller.name)}">` +
    `<СвСчФакт НомерДок="${esc(input.number)}" ДатаДок="${dateRu(input.date)}">` +
    party("СвПрод", input.seller) +
    `<ГрузОт>${party("ГрузОтпр", input.seller)}</ГрузОт>` +
    party("ГрузПолуч", consignee) +
    party("СвПокуп", input.buyer) +
    `<ДенИзм КодОКВ="643" НаимОКВ="Российский рубль"/>` +
    `</СвСчФакт>` +
    `<ТаблСчФакт>${rows.join("")}${totals}</ТаблСчФакт>` +
    `<СвПродПер><СвПер СодОпер="Товары переданы" ДатаПер="${dateRu(input.date)}">` +
    (() => {
      const basis = parseBasis(input.basis, input.date);
      return (
        `<ОснПер РеквНаимДок="${esc(basis.name)}"` +
        ` РеквНомерДок="${esc(basis.number)}" РеквДатаДок="${basis.date}"/>`
      );
    })() +
    `<СвЛицПер><РабОргПрод Должность="${esc(input.signerTitle || "Руководитель")}">` +
    signerFio +
    `</РабОргПрод></СвЛицПер></СвПер></СвПродПер>` +
    // Способ подтверждения полномочий 1 — подписант работает у составителя.
    `<Подписант СпосПодтПолном="1">${signerFio}</Подписант>` +
    `</Документ></Файл>`;

  return {
    fileName: `${fileId}.xml`,
    buffer: encodeCp1251(xml),
  };
}

/**
 * Перекодировка в windows-1251.
 *
 * Node не умеет её из коробки, а тянуть зависимость ради одной таблицы не
 * стоит: нам нужны только кириллица и латиница, и они ложатся в один байт по
 * простому правилу.
 */
function encodeCp1251(text: string): Buffer {
  const bytes = Buffer.alloc(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes[i] = code;
    } else if (code >= 0x0410 && code <= 0x044f) {
      // А-я идут подряд и в юникоде, и в 1251.
      bytes[i] = code - 0x0410 + 0xc0;
    } else if (code === 0x0401) {
      bytes[i] = 0xa8; // Ё
    } else if (code === 0x0451) {
      bytes[i] = 0xb8; // ё
    } else {
      bytes[i] = SPECIAL[code] ?? 0x3f; // «?» вместо непредставимого символа
    }
  }
  return bytes;
}

/** Знаки, которые попадаются в названиях и адресах. */
const SPECIAL: Record<number, number> = {
  0x2116: 0xb9, // №
  0x00ab: 0xab, // «
  0x00bb: 0xbb, // »
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x2026: 0x85, // …
  0x00a0: 0xa0, // неразрывный пробел
  0x00b0: 0xb0, // °
  0x2019: 0x92, // ’
  0x201c: 0x93, // “
  0x201d: 0x94, // ”
};
