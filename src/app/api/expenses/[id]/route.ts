import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MONEY_WRITE_ROLES } from "@/lib/money-roles";

const schema = z.object({
  date: z.string().datetime().optional(),
  amount: z.coerce.number().positive().optional(),
  accountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  comment: z.string().max(500).optional(),
  orderId: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!MONEY_WRITE_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());
  const { date, ...rest } = parsed.data;

  const expense = await prisma.expense.update({
    where: { id },
    data: { ...rest, ...(date ? { date: new Date(date) } : {}) },
    include: {
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ ...expense, amount: Number(expense.amount) });
}

/** Удаление — в корзину: ошибиться суммой легко, потерять запись насовсем обидно. */
export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!MONEY_WRITE_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  await prisma.expense.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: session.user.id },
  });
  return NextResponse.json({ ok: true });
}
