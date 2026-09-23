import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MONEY_WRITE_ROLES } from "@/lib/money-roles";

const schema = z.object({
  name: z.string().min(1).max(64).optional(),
  kind: z.enum(["CASH", "CARD", "BANK"]).optional(),
  startBalance: z.coerce.number().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!MONEY_WRITE_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  const account = await prisma.moneyAccount.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ...account, startBalance: Number(account.startBalance) });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!MONEY_WRITE_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;

  // Счёт, по которому уже есть движения, удалять нельзя: пропала бы привязка
  // у прихода и расхода, и отчёт перестал бы сходиться. Его можно скрыть.
  const [payments, expenses] = await Promise.all([
    prisma.payment.count({ where: { accountId: id } }),
    prisma.expense.count({ where: { accountId: id } }),
  ]);
  const used = payments + expenses;
  if (used > 0) {
    return NextResponse.json(
      {
        error: `По счёту уже есть движения (${used}). Его можно скрыть — тогда он пропадёт из списков, но история сохранится.`,
      },
      { status: 409 },
    );
  }

  await prisma.moneyAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
