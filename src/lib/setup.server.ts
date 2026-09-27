import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Нужен ли мастер первичной настройки.
 *
 * Новая установка встречает админа мастером: реквизиты, печать, сотрудники —
 * чтобы не гадать «что где заполнять». Считаем, что настройка нужна, пока
 * мастер не завершён И реквизиты не заполнены: так прежние установки, где
 * компанию уже заполнили руками до появления мастера, его не увидят.
 */
export const needsSetup = cache(async (): Promise<boolean> => {
  const s = await prisma.companySettings
    .findFirst({ select: { setupCompletedAt: true, name: true, inn: true } })
    .catch(() => null);

  if (!s) return true; // настроек ещё нет вовсе
  if (s.setupCompletedAt) return false; // мастер уже проходили
  return !(s.name?.trim() || s.inn?.trim()); // есть реквизиты — считаем настроенной
});
