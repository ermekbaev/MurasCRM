import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MONEY_WRITE_ROLES } from "@/lib/money-roles";

const schema = z.object({
  name: z.string().min(1).max(64).optional(),
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

  const category = await prisma.expenseCategory.update({ where: { id }, data: parsed.data });
  return NextResponse.json(category);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!MONEY_WRITE_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;

  // Статью, по которой уже есть расходы, не удаляем: иначе они осели бы без
  // категории и пропали из разбивки. Её можно скрыть.
  const used = await prisma.expense.count({ where: { categoryId: id } });
  if (used > 0) {
    return NextResponse.json(
      {
        error: `По статье уже есть расходы (${used}). Её можно скрыть — тогда она пропадёт из выбора, но история сохранится.`,
      },
      { status: 409 },
    );
  }

  await prisma.expenseCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
