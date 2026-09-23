import { NextResponse } from "next/server";
import { prismaRaw } from "@/lib/prisma";
import { TRASH_KEEP_DAYS } from "@/app/api/trash/route";

/**
 * Автоочистка корзины.
 *
 * Держать удалённое вечно нельзя: база растёт, а вместе с ней и цена ошибки —
 * восстановить можно и то, что удалили намеренно год назад. Через месяц запись
 * исчезает по-настоящему, вместе со всем, что к ней привязано.
 *
 * Дёргается из cron по расписанию, как напоминания о сроках: тем же секретом.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - TRASH_KEEP_DAYS * 24 * 60 * 60 * 1000);
  const where = { deletedAt: { lt: cutoff } };

  // Порядок важен: документы ссылаются на заявки и клиентов, поэтому сначала
  // они, а заявки и клиенты — следом.
  const invoices = await prismaRaw.invoice.deleteMany({ where });
  const acts = await prismaRaw.act.deleteMany({ where });
  const waybills = await prismaRaw.waybill.deleteMany({ where });
  const expenses = await prismaRaw.expense.deleteMany({ where });
  const orders = await prismaRaw.order.deleteMany({ where });
  const clients = await prismaRaw.client.deleteMany({ where });

  const purged = {
    invoices: invoices.count,
    acts: acts.count,
    waybills: waybills.count,
    expenses: expenses.count,
    orders: orders.count,
    clients: clients.count,
  };
  const total = Object.values(purged).reduce((sum, n) => sum + n, 0);

  return NextResponse.json({ ok: true, keepDays: TRASH_KEEP_DAYS, total, purged });
}
