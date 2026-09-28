import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ensureDefaultOrderTypes } from "@/lib/defaults.server";

/**
 * Отметить мастер первичной настройки завершённым.
 *
 * Ставит только галку-дату — сами реквизиты, печать и сотрудники сохраняются
 * шагами мастера через существующие ручки (/api/settings, /api/settings/logo,
 * /api/users). После этого админа в мастер больше не перекидывает.
 */
export async function POST() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  // Свежая установка стартует с пустым справочником типов — без него заявку
  // не создать. Заводим дефолтные, если их ещё нет.
  await ensureDefaultOrderTypes();

  const existing = await prisma.companySettings.findFirst({ select: { id: true } });
  if (existing) {
    await prisma.companySettings.update({
      where: { id: existing.id },
      data: { setupCompletedAt: new Date() },
    });
  } else {
    await prisma.companySettings.create({
      data: { id: "default", setupCompletedAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
