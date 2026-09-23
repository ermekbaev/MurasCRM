import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MONEY_WRITE_ROLES } from "@/lib/money-roles";

const schema = z.object({
  date: z.string().datetime().optional(),
  amount: z.coerce.number().positive().optional(),
  accountId: z.string().nullable().optional(),
  comment: z.string().max(500).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!MONEY_WRITE_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());
  const { date, amount, ...rest } = parsed.data;

  const existing = await prisma.payment.findUnique({ where: { id } });
  if (!existing) return apiError.notFound();

  // Сумму платежа по заявке менять нельзя: она уже зачтена в оплату заявки, и
  // правка здесь разошлась бы с тем, сколько заявка считает оплаченным.
  if (existing.orderId && amount !== undefined && amount !== Number(existing.amount)) {
    return NextResponse.json(
      {
        error:
          "Это оплата по заявке — сумму меняйте через саму заявку, иначе разойдётся с её оплатой.",
      },
      { status: 409 },
    );
  }

  const payment = await prisma.payment.update({
    where: { id },
    data: {
      ...rest,
      ...(amount !== undefined ? { amount } : {}),
      ...(date ? { date: new Date(date) } : {}),
    },
    include: { account: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ ...payment, amount: Number(payment.amount) });
}

/**
 * Удалить ошибочный приход.
 *
 * Только тот, что записан отдельно. Оплату, зачтённую в заявку, отсюда не
 * трогаем: заявка считает её частью оплаченной суммы, и молчаливое удаление
 * оставило бы заявку «оплаченной» деньгами, которых нет.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!MONEY_WRITE_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return apiError.notFound();

  if (payment.orderId) {
    return NextResponse.json(
      {
        error:
          "Это оплата по заявке. Отменить её можно только в самой заявке — иначе она останется оплаченной.",
      },
      { status: 409 },
    );
  }

  await prisma.payment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
