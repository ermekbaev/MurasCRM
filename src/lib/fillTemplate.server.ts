import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/s3";
import { buildTemplateVars, buildTemplateRows } from "@/lib/templateVars.server";
import { swapTemplateImages, type ImageSwapResult, type SlotImage } from "@/lib/docxImages";
import { DOCUMENT_VAR_KEYS } from "@/lib/documentVars";

/**
 * Заполнение загруженного DOCX-бланка данными заявки, счёта или накладной.
 *
 * Вынесено из /api/templates/[id]/render-docx (25.11, Сергей из DASS): тот же бланк
 * теперь печатается и из раздела «Счета», чтобы счёт везде выглядел одинаково.
 *
 * Переменные в шаблоне пишутся как {client_name} — одинарные фигурные скобки,
 * так их понимает docxtemplater. Позиции вставляются циклом:
 *   {#items}{n} {name} {qty} {unit} {price} {total}{/items}
 * — цикл ставится на строку таблицы, и она размножается по числу позиций.
 */

export type TemplateContext = { orderId?: string; invoiceId?: string; clientId?: string; waybillId?: string };

/** Файла бланка нет в хранилище. */
export class TemplateFileMissingError extends Error {}

export async function fillDocxTemplate(
  fileKey: string,
  ctx: TemplateContext,
  withStamp: boolean,
): Promise<{ out: Buffer; skipped: ImageSwapResult["skipped"] }> {
  const [vars, items, file] = await Promise.all([
    buildTemplateVars(ctx),
    buildTemplateRows({ orderId: ctx.orderId, invoiceId: ctx.invoiceId, waybillId: ctx.waybillId }),
    getObjectBuffer(fileKey).catch(() => null),
  ]);
  if (!file) throw new TemplateFileMissingError("Файл шаблона недоступен в хранилище");

  const [{ default: PizZip }, { default: Docxtemplater }] = await Promise.all([import("pizzip"), import("docxtemplater")]);
  const zip = new PizZip(file);

  // docxtemplater, заполняя текст, дописывает xml:space="preserve" и ищет
  // уже существующий атрибут с учётом кавычек. Если бланк сохранён программой,
  // пишущей атрибуты в одинарных кавычках, получается дубль, и заполненный
  // файл не открывают ни Word, ни LibreOffice. Приводим к двойным заранее.
  for (const part of Object.keys(zip.files)) {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(part)) continue;
    const xml = zip.file(part)?.asText();
    if (xml && xml.includes("xml:space='preserve'")) {
      zip.file(part, xml.replaceAll("xml:space='preserve'", 'xml:space="preserve"'));
    }
  }

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Известная переменная без данных в этом контексте (например, номер
    // счёта, когда документ делают из заявки) — просто пусто. Видимой
    // оставляем только незнакомую: это опечатка в шаблоне.
    nullGetter: (part: { value?: string }) => {
      const key = part.value;
      if (!key) return "";
      return DOCUMENT_VAR_KEYS.includes(key) ? "" : `{${key}}`;
    },
  });

  // Флаги для условных блоков в бланке: {#has_vat}…{/has_vat}.
  // docxtemplater покажет содержимое, только если значение истинно.
  const settings = await prisma.companySettings.findFirst();
  const flags = {
    has_vat: Boolean(settings?.worksWithVat),
    has_items: items.length > 0,
    has_stamp: Boolean(settings?.stampKey),
  };

  doc.render({ ...vars, ...flags, items });

  // Печать и подпись подставляем после заполнения текста: заглушки в
  // бланке помечены в «Замещающем тексте» словами stamp и signature.
  // Без галки они гасятся прозрачным пикселем — закрывающие документы
  // часто печатают и подписывают от руки.
  const slots: SlotImage[] = [];
  for (const [slot, key] of [
    ["stamp", settings?.stampKey],
    ["signature", settings?.signatureKey],
    // Логотип — часть бланка, а не подпись: ставим его всегда,
    // галка управляет только печатью и подписью.
    ["logo", settings?.logoKey],
  ] as const) {
    if ((slot !== "logo" && !withStamp) || !key) {
      slots.push({ slot, data: null, ext: null });
      continue;
    }
    const data = await getObjectBuffer(key).catch(() => null);
    slots.push({ slot, data, ext: key.split(".").pop()?.toLowerCase() ?? null });
  }
  const swap = swapTemplateImages(doc.getZip(), slots);

  const out = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  return { out, skipped: swap.skipped };
}

/** Текст ошибки docxtemplater для человека: в ней список проблемных мест шаблона. */
export function templateErrorText(e: unknown): string {
  const err = e as { message?: string; properties?: { errors?: { properties?: { explanation?: string } }[] } };
  const details = err.properties?.errors
    ?.map((x) => x.properties?.explanation)
    .filter(Boolean)
    .join("; ");
  return details || err.message || "Не удалось заполнить шаблон";
}

/** Шаблон счёта «по умолчанию» (Word), если клиент его загрузил: по нему печатается и раздел «Счета». */
export function defaultInvoiceTemplate() {
  return prisma.documentTemplate.findFirst({
    where: { type: "INVOICE", kind: "DOCX", isDefault: true, fileKey: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, fileKey: true },
  });
}
