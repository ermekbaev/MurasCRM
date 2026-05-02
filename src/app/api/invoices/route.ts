import { NextResponse } from "next/server";
import { requireAuth, retryOnDuplicate } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { generateInvoiceNumber } from "@/lib/utils";
import { notifyInvoiceCreated } from "@/lib/telegram";

const itemSchema = z.object({
  name: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string(),
  price: z.number().nonnegative(),
});

const invoiceSchema = z.object({
  clientId: z.string().min(1),
  orderId: z.string().optional(),
  number: z.string().optional(),
  date: z.string().optional(),
  dueDate: z.string().optional(),
  vatRate: z.number().min(0).max(100).default(0),
  basis: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const isPaid = searchParams.get("isPaid");

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { number: { contains: search, mode: "insensitive" } },
      { client: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (isPaid !== null && isPaid !== "") {
    where.isPaid = isPaid === "true";
  }

  const pageQ = z.object({
    page: z.coerce.number().int().positive().max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }).parse(Object.fromEntries(searchParams));
  const skip = (pageQ.page - 1) * pageQ.limit;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: pageQ.limit,
      orderBy: { date: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        order: { select: { id: true, number: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return NextResponse.json({
    invoices: invoices.map((i) => ({
      ...i,
      subtotal: Number(i.subtotal),
      vatAmount: Number(i.vatAmount),
      total: Number(i.total),
    })),
    total,
    page: pageQ.page,
    pages: Math.ceil(total / pageQ.limit),
  });
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER", "ACCOUNTANT"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { items, date, dueDate, vatRate, number: numberOverride, ...rest } = parsed.data;

  const subtotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
  const vatAmount = (subtotal * vatRate) / 100;
  const total = subtotal + vatAmount;
  const calculatedItems = items.map((i) => ({ ...i, total: i.qty * i.price }));
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const invoice = await retryOnDuplicate(async (attempt) => {
    let number: string;
    if (numberOverride?.trim()) {
      number = numberOverride.trim();
    } else {
      const count = await prisma.invoice.count({ where: { createdAt: { gte: yearStart } } });
      number = generateInvoiceNumber(count + attempt);
    }
    return prisma.invoice.create({
      data: {
        ...rest,
        number,
        vatRate,
        subtotal,
        vatAmount,
        total,
        date: date ? new Date(date) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        items: { create: calculatedItems },
      },
      include: { client: { select: { name: true } }, items: true },
    });
  });

  notifyInvoiceCreated(invoice.id).catch(console.error);

  return NextResponse.json(invoice, { status: 201 });
}
