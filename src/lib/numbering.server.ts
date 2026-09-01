// Только для серверных модулей: тянет prisma.
import { prisma } from "@/lib/prisma";

export type DocumentKind = "order" | "invoice" | "act" | "waybill";

const DEFAULT_PREFIX: Record<DocumentKind, string> = {
  order: "ЗАК",
  invoice: "СЧ",
  act: "АКТ",
  waybill: "НАКЛ",
};

/** Номера этого года с этим префиксом — по каждому виду документа своя таблица. */
async function existingNumbers(kind: DocumentKind, head: string): Promise<string[]> {
  const where = { number: { startsWith: head } };
  const select = { number: true };
  switch (kind) {
    case "order":
      return (await prisma.order.findMany({ where, select })).map((r) => r.number);
    case "invoice":
      return (await prisma.invoice.findMany({ where, select })).map((r) => r.number);
    case "act":
      return (await prisma.act.findMany({ where, select })).map((r) => r.number);
    case "waybill":
      return (await prisma.waybill.findMany({ where, select })).map((r) => r.number);
  }
}

/**
 * Следующий номер документа: ПРЕФИКС-ГОД-NNN.
 *
 * Считаем от максимального существующего номера за текущий год, а не от
 * количества записей. Это даёт две вещи разом: нумерация не ломается после
 * удаления документа, и можно «начать с нужной цифры» — достаточно один раз
 * выставить номер вручную, дальше счёт продолжится от него.
 *
 * Первого января счётчик начинается заново, потому что в префикс входит год.
 */
export async function nextDocumentNumber(kind: DocumentKind, attempt = 0): Promise<string> {
  const settings = await prisma.companySettings.findFirst();
  const configured =
    kind === "order" ? settings?.orderPrefix
    : kind === "invoice" ? settings?.invoicePrefix
    : kind === "act" ? settings?.actPrefix
    : settings?.waybillPrefix;

  const prefix = configured?.trim() || DEFAULT_PREFIX[kind];
  const year = new Date().getFullYear();
  const head = `${prefix}-${year}-`;

  const numbers = await existingNumbers(kind, head);
  const max = numbers.reduce((acc, n) => {
    const seq = parseInt(n.slice(head.length), 10);
    return Number.isFinite(seq) && seq > acc ? seq : acc;
  }, 0);

  return head + String(max + 1 + attempt).padStart(3, "0");
}
