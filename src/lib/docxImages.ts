/**
 * Подстановка печати и подписи в DOCX-бланк.
 *
 * Программная вставка изображений в docxtemplater — платный модуль, поэтому
 * идём другим путём: .docx это zip, и картинку внутри можно подменить байтами.
 *
 * Договорённость с пользователем: в бланк вставляется любая картинка-заглушка,
 * а в её «Замещающем тексте» (Формат рисунка → Замещающий текст) пишется
 * stamp, signature или logo. При выгрузке мы находим её по этой пометке и
 * заменяем на картинку из настроек компании — либо на прозрачный пиксель,
 * если документ выгружают без них.
 */

import type PizZipType from "pizzip";

/** Прозрачный PNG 1×1 — им гасим заглушку, когда печать не нужна. */
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

export type ImageSlot = "stamp" | "signature" | "logo";

export interface SlotImage {
  slot: ImageSlot;
  /** Байты картинки. Пусто — заглушку гасим прозрачным пикселем. */
  data: Buffer | null;
  /** Расширение исходника: подменять можно только совпадающий формат. */
  ext: string | null;
}

export interface ImageSwapResult {
  replaced: ImageSlot[];
  /** Пометки, найденные в бланке, но заменить их не вышло. */
  skipped: { slot: ImageSlot; reason: string }[];
}

/** rId -> путь к файлу внутри архива (word/media/...). */
function relationTargets(zip: PizZipType): Record<string, string> {
  const rels = zip.file("word/_rels/document.xml.rels")?.asText() ?? "";
  const map: Record<string, string> = {};
  for (const m of rels.matchAll(/Id=["']([^"']+)["'][^>]*Target=["']([^"']+)["']/g)) {
    map[m[1]] = m[2].replace(/^\.\//, "");
  }
  return map;
}

/**
 * Находит rId картинки, помеченной нужным словом.
 *
 * Ищем блок <w:drawing>, внутри которого docPr с нужным descr, и берём
 * ближайший r:embed. Разбор регулярками, а не XML-парсером: структура здесь
 * предсказуемая, а тянуть парсер ради одного тега не хочется.
 */
function findEmbedForSlot(documentXml: string, slot: ImageSlot): string | null {
  const drawings = documentXml.match(/<w:drawing>[\s\S]*?<\/w:drawing>/g) ?? [];
  for (const drawing of drawings) {
    const descr = drawing.match(/<wp:docPr[^>]*descr=["']([^"']*)["']/i)?.[1] ?? "";
    const name = drawing.match(/<wp:docPr[^>]*name=["']([^"']*)["']/i)?.[1] ?? "";
    const marker = `${descr} ${name}`.toLowerCase();
    if (!marker.includes(slot)) continue;

    const embed = drawing.match(/r:embed=["']([^"']+)["']/)?.[1];
    if (embed) return embed;
  }
  return null;
}

/**
 * Подменяет картинки-заглушки в архиве бланка.
 * Меняет содержимое zip на месте и возвращает отчёт, что удалось.
 */
export function swapTemplateImages(zip: PizZipType, images: SlotImage[]): ImageSwapResult {
  const result: ImageSwapResult = { replaced: [], skipped: [] };

  const documentXml = zip.file("word/document.xml")?.asText();
  if (!documentXml) return result;

  const targets = relationTargets(zip);

  for (const { slot, data, ext } of images) {
    const embed = findEmbedForSlot(documentXml, slot);
    if (!embed) {
      // Печать просили, а метки в бланке нет — молчать нельзя, иначе человек
      // решит, что подстановка сломана.
      if (data) {
        result.skipped.push({
          slot,
          reason: `в бланке нет картинки с пометкой «${slot}» в замещающем тексте`,
        });
      }
      continue;
    }

    const target = targets[embed];
    if (!target) {
      result.skipped.push({ slot, reason: "картинка не найдена внутри файла" });
      continue;
    }

    const path = target.startsWith("media/") ? `word/${target}` : `word/${target}`;
    if (!zip.file(path)) {
      result.skipped.push({ slot, reason: "картинка не найдена внутри файла" });
      continue;
    }

    if (!data) {
      // Выгрузка без печати: заглушка остаётся, но становится невидимой.
      zip.file(path, TRANSPARENT_PNG);
      result.replaced.push(slot);
      continue;
    }

    // Word ориентируется на расширение файла внутри архива. Подменять PNG
    // на JPEG нельзя — документ откроется с ошибкой.
    const placeholderExt = path.split(".").pop()?.toLowerCase() ?? "";
    if (ext && placeholderExt && ext !== placeholderExt) {
      result.skipped.push({
        slot,
        reason: `в бланке картинка .${placeholderExt}, а в настройках .${ext} — форматы должны совпадать`,
      });
      continue;
    }

    zip.file(path, data);
    result.replaced.push(slot);
  }

  return result;
}
