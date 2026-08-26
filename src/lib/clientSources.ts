import { prisma } from "@/lib/prisma";
import { slugifyCode } from "@/lib/slug";

// Встроенные источники — запасной вариант, если справочник пуст.
export const DEFAULT_CLIENT_SOURCE_LABELS: Record<string, string> = {
  REFERRAL: "Рекомендация",
  ADVERTISING: "Реклама",
  COLD_CALL: "Звонок",
  SOCIAL_MEDIA: "Соцсети",
  OTHER: "Другое",
};

/** Карта code -> label из справочника (со встроенными значениями как запасными). */
export async function getClientSourceLabels(): Promise<Record<string, string>> {
  const sources = await prisma.clientSourceOption.findMany();
  const map: Record<string, string> = { ...DEFAULT_CLIENT_SOURCE_LABELS };
  for (const s of sources) map[s.code] = s.label;
  return map;
}

export function slugifyClientSourceCode(label: string): string {
  return slugifyCode(label, "SOURCE");
}
