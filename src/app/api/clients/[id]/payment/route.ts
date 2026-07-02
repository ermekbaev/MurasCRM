import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const PAYMENT_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT"];
const EPS = 0.005;

const schema = z.object({
  amount: z.number().positive(),
});

function derivePaymentStatus(
  paid: number,
  amount: number
): "UNPAID" | "PARTIAL" | "PAID" {
  if (paid <= EPS) return "UNPAID";
  if (paid >= amount - EPS) return "PAID";
  return "PARTIAL";
}

// Принять оплату от клиента и распределить её по неоплаченным заявкам
// (от самых старых к новым). На заявку, которой не хватило, ставится PARTIAL.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!PAYMENT_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const { id } = await params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const orders = await prisma.order.findMany({
    where: { clientId: id },
    orderBy: { createdAt: "asc" },
  });

  let remaining = parsed.data.amount;
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  const allocations: { number: string; pay: number; status: string }[] = [];

  for (const o of orders) {
    if (remaining <= EPS) break;
    if (o.paymentStatus === "PAID") continue;
    const amount = Number(o.amount);
    const paid = Number(o.paidAmount);
    const debt = Math.round((amount - paid) * 100) / 100;
    if (debt <= EPS) continue;

    const pay = Math.min(debt, remaining);
    const newPaid = Math.round((paid + pay) * 100) / 100;
    const status = derivePaymentStatus(newPaid, amount);

    ops.push(
      prisma.order.update({
        where: { id: o.id },
        data: { paidAmount: newPaid, paymentStatus: status },
      })
    );
    ops.push(
      prisma.payment.create({
        data: {
          clientId: id,
          orderId: o.id,
          amount: pay,
          userId: session.user.id,
          userName: session.user.name ?? null,
        },
      })
    );
    allocations.push({ number: o.number, pay, status });
    remaining = Math.round((remaining - pay) * 100) / 100;
  }

  if (allocations.length === 0) {
    return NextResponse.json(
      { error: "У клиента нет неоплаченных заявок" },
      { status: 400 }
    );
  }

  await prisma.$transaction(ops);

  return NextResponse.json({
    allocated: Math.round((parsed.data.amount - remaining) * 100) / 100,
    leftover: remaining,
    allocations,
  });
}
