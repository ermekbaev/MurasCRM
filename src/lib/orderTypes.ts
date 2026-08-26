import { prisma } from "@/lib/prisma";
import { slugifyCode } from "@/lib/slug";

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

// Генерирует машинный код (UPPER_SNAKE) из человекочитаемого названия
export function slugifyOrderTypeCode(label: string): string {
  return slugifyCode(label, "TYPE");
}
