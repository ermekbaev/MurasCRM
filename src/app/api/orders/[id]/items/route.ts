import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const itemSchema = z.object({
  equipmentId: z.string().optional().nullable(),
  name: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string().min(1),
  price: z.number().min(0),
  discount: z.number().min(0).max(100).default(0),
  total: z.number().min(0),
  includeWaste: z.boolean().default(true),
});

const replaceSchema = z.object({
  items: z.array(itemSchema).min(1),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const items = await prisma.orderItem.findMany({
    where: { orderId: id },
    include: { equipment: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(items.map((i) => ({
    ...i,
    qty: Number(i.qty),
    price: Number(i.price),
    discount: Number(i.discount),
    total: Number(i.total),
  })));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = replaceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const total = parsed.data.items.reduce((sum, i) => sum + i.total, 0);

  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { orderId: id } }),
    prisma.orderItem.createMany({
      data: parsed.data.items.map((i) => ({ ...i, orderId: id })),
    }),
    prisma.order.update({ where: { id }, data: { amount: total } }),
  ]);

  const items = await prisma.orderItem.findMany({
    where: { orderId: id },
    include: { equipment: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    items: items.map((i) => ({ ...i, qty: Number(i.qty), price: Number(i.price), discount: Number(i.discount), total: Number(i.total) })),
    amount: total,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const item = await prisma.orderItem.create({ data: { ...parsed.data, orderId: id } });

  await prisma.order.update({
    where: { id },
    data: { amount: { increment: parsed.data.total } },
  });

  return NextResponse.json({
    ...item,
    qty: Number(item.qty),
    price: Number(item.price),
    discount: Number(item.discount),
    total: Number(item.total),
  }, { status: 201 });
}
