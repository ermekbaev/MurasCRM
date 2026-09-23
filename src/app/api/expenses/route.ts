import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MONEY_READ_ROLES, MONEY_WRITE_ROLES } from "@/lib/money-roles";
import { periodRange } from "@/lib/money-period";

const schema = z.object({
  date: z.string().datetime().optional(),
  amount: z.coerce.number().positive(),
  accountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  comment: z.string().max(500).default(""),
  orderId: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
});

/** Расходы за период: аренда, закупка, реклама — всё, что уходит из кассы. */
export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!MONEY_READ_ROLES.includes(session.user.role)) return apiError.forbidden();

  const url = new URL(req.url);
  const { from, to } = periodRange(url.searchParams);
  const accountId = url.searchParams.get("accountId");
  const categoryId = url.searchParams.get("categoryId");

  const expenses = await prisma.expense.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(accountId ? { accountId } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500,
    include: {
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      order: { select: { id: true, number: true } },
      supplier: { select: { id: true, name: true } },
    },
  });

  const total = await prisma.expense.aggregate({
    where: {
      date: { gte: from, lte: to },
      ...(accountId ? { accountId } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    _sum: { amount: true },
  });

  return NextResponse.json({
    items: expenses.map((e) => ({ ...e, amount: Number(e.amount) })),
    total: Number(total._sum.amount ?? 0),
  });
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!MONEY_WRITE_ROLES.includes(session.user.role)) return apiError.forbidden();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());
  const { date, ...rest } = parsed.data;

  const expense = await prisma.expense.create({
    data: {
      ...rest,
      date: date ? new Date(date) : new Date(),
      userId: session.user.id,
      userName: session.user.name ?? null,
    },
    include: {
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ ...expense, amount: Number(expense.amount) }, { status: 201 });
}
