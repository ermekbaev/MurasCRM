import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MONEY_WRITE_ROLES, PAYMENT_ROLES } from "@/lib/money-roles";

const schema = z.object({
  name: z.string().min(1).max(64),
  kind: z.enum(["CASH", "CARD", "BANK"]).default("CASH"),
  startBalance: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

/**
 * Счета и кассы: «Карта Сбер», «Наличные», расчётный счёт.
 *
 * Список ведёт сам владелец — у каждого свой набор карт, угадать его нельзя.
 */
export async function GET() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  // Список счетов нужен и менеджеру: он выбирает, куда пришла оплата клиента.
  // Суммы и остатки при этом остаются в отчёте, который менеджеру не виден.
  if (!PAYMENT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const accounts = await prisma.moneyAccount.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(
    accounts.map((a) => ({ ...a, startBalance: Number(a.startBalance) })),
  );
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!MONEY_WRITE_ROLES.includes(session.user.role)) return apiError.forbidden();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  const max = await prisma.moneyAccount.aggregate({ _max: { sortOrder: true } });
  const account = await prisma.moneyAccount.create({
    data: { ...parsed.data, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(
    { ...account, startBalance: Number(account.startBalance) },
    { status: 201 },
  );
}
