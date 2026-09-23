import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MONEY_READ_ROLES, PAYMENT_ROLES } from "@/lib/money-roles";
import { periodRange } from "@/lib/money-period";

const schema = z.object({
  date: z.string().datetime().optional(),
  amount: z.coerce.number().positive(),
  accountId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  comment: z.string().max(500).default(""),
});

/** Приход за период — и от клиентов по заявкам, и просто внесённые деньги. */
export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!MONEY_READ_ROLES.includes(session.user.role)) return apiError.forbidden();

  const url = new URL(req.url);
  const { from, to } = periodRange(url.searchParams);
  const accountId = url.searchParams.get("accountId");

  const where = {
    date: { gte: from, lte: to },
    ...(accountId ? { accountId } : {}),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500,
      include: {
        account: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        order: { select: { id: true, number: true } },
      },
    }),
    prisma.payment.aggregate({ where, _sum: { amount: true } }),
  ]);

  return NextResponse.json({
    items: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    total: Number(total._sum.amount ?? 0),
  });
}

/**
 * Приход без привязки к заявке.
 *
 * Оплату по заявкам разносит /api/clients/[id]/payment — там сумма гасит долги
 * по порядку. Здесь просто записывается факт: пришли деньги, вот на какой счёт.
 */
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!PAYMENT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());
  const { date, ...rest } = parsed.data;

  const payment = await prisma.payment.create({
    data: {
      ...rest,
      date: date ? new Date(date) : new Date(),
      userId: session.user.id,
      userName: session.user.name ?? null,
    },
    include: {
      account: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ ...payment, amount: Number(payment.amount) }, { status: 201 });
}
