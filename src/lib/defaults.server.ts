import { prisma } from "@/lib/prisma";

/**
 * Дефолтные типы заявок для новой установки.
 *
 * Без них справочник пуст, в форме заявки нет ни одного типа, и создать заявку
 * нельзя («Неизвестный тип заявки»). Набор общий для печати/рекламы — клиент
 * потом правит под себя в Настройках.
 */
const DEFAULT_ORDER_TYPES: { code: string; label: string }[] = [
  { code: "DTF", label: "DTF-печать" },
  { code: "UV_DTF", label: "UV DTF" },
  { code: "UV_FLATBED", label: "UV планшет" },
  { code: "WIDE_FORMAT", label: "Широкоформат" },
  { code: "LASER_CUT", label: "Лазерная резка" },
  { code: "PLOTTER_CUT", label: "Плоттерная резка" },
  { code: "OFFSET", label: "Офсет / полиграфия" },
  { code: "OTHER", label: "Другое" },
];

/**
 * Заводит дефолтные типы заявок, если справочник пуст. Идемпотентно: на
 * установке, где типы уже есть (свои или прежние), ничего не трогает.
 */
export async function ensureDefaultOrderTypes(): Promise<void> {
  const count = await prisma.orderTypeOption.count();
  if (count > 0) return;
  await prisma.orderTypeOption.createMany({
    data: DEFAULT_ORDER_TYPES.map((t, i) => ({ ...t, sortOrder: i + 1 })),
    skipDuplicates: true,
  });
}
