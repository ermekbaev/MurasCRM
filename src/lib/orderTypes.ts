import { prisma } from "@/lib/prisma";

// Встроенные типы заявок — служат запасным вариантом, если справочник пуст
export const DEFAULT_ORDER_TYPE_LABELS: Record<string, string> = {
  DTF: "DTF-печать",
  UV_DTF: "UV DTF",
  UV_FLATBED: "UV планшет",
  LASER_CUT: "Лазерная резка",
  PLOTTER_CUT: "Плоттерная резка",
  HIGH_PRECISION: "Высокоточная печать",
  COMBO: "Комбо",
};

// Карта code -> label из справочника (с запасными встроенными значениями)
export async function getOrderTypeLabels(): Promise<Record<string, string>> {
  const types = await prisma.orderTypeOption.findMany();
  const map: Record<string, string> = { ...DEFAULT_ORDER_TYPE_LABELS };
  for (const t of types) map[t.code] = t.label;
  return map;
}

const RU_TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

// Генерирует машинный код (UPPER_SNAKE) из человекочитаемого названия
export function slugifyOrderTypeCode(label: string): string {
  const base = label
    .toLowerCase()
    .split("")
    .map((c) => (c in RU_TRANSLIT ? RU_TRANSLIT[c] : c))
    .join("")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return base || "TYPE";
}
