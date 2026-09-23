import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MONEY_READ_ROLES, MONEY_WRITE_ROLES } from "@/lib/money-roles";

const schema = z.object({
  name: z.string().min(1).max(64),
  isActive: z.boolean().default(true),
});

/** Статьи расходов: аренда, закупка материалов, реклама, налоги. */
export async function GET() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!MONEY_READ_ROLES.includes(session.user.role)) return apiError.forbidden();

  const categories = await prisma.expenseCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!MONEY_WRITE_ROLES.includes(session.user.role)) return apiError.forbidden();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  const max = await prisma.expenseCategory.aggregate({ _max: { sortOrder: true } });
  const category = await prisma.expenseCategory.create({
    data: { ...parsed.data, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(category, { status: 201 });
}
