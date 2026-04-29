import { NextResponse } from "next/server";
import { requireAuth, retryOnDuplicate } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateActNumber } from "@/lib/utils";
import { z } from "zod";

const schema = z.object({
  invoiceId: z.string().optional(),
  orderId: z.string().optional(),
  date: z.string().optional(),
  items: z.array(z.object({
    name: z.string(),
    qty: z.number().positive(),
    unit: z.string(),
    price: z.number().nonnegative(),
  })).min(1),
});

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const acts = await prisma.act.findMany({
    orderBy: { date: "desc" },
    include: {
      invoice: { include: { client: { select: { id: true, name: true } } } },
      order: { select: { id: true, number: true } },
    },
  });

  return NextResponse.json(acts.map((a) => ({ ...a, total: Number(a.total) })));
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER", "ACCOUNTANT"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { items, date, ...rest } = parsed.data;
  const calculatedItems = items.map((i) => ({ ...i, total: i.qty * i.price }));
  const total = calculatedItems.reduce((sum, i) => sum + i.total, 0);
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const act = await retryOnDuplicate(async (attempt) => {
    const count = await prisma.act.count({ where: { createdAt: { gte: yearStart } } });
    const number = generateActNumber(count + attempt);
    return prisma.act.create({
      data: {
        ...rest,
        number,
        total,
        date: date ? new Date(date) : new Date(),
        items: { create: calculatedItems },
      },
    });
  });

  return NextResponse.json(act, { status: 201 });
}
