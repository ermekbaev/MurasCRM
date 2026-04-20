import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  date: z.string().optional(),
  items: z.array(z.object({
    name: z.string(),
    qty: z.number().positive(),
    unit: z.string(),
    price: z.number().nonnegative(),
  })).min(1).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const act = await prisma.act.findUnique({
    where: { id },
    include: {
      items: true,
      invoice: { include: { client: true } },
      order: { select: { id: true, number: true } },
    },
  });

  if (!act) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...act, total: Number(act.total) });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER", "ACCOUNTANT"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { items, date } = parsed.data;

  const calculatedItems = items?.map((i) => ({ ...i, total: i.qty * i.price }));
  const total = calculatedItems?.reduce((sum, i) => sum + i.total, 0);

  const act = await prisma.$transaction(async (tx) => {
    if (calculatedItems) {
      await tx.actItem.deleteMany({ where: { actId: id } });
      await tx.actItem.createMany({ data: calculatedItems.map((i) => ({ ...i, actId: id })) });
    }
    return tx.act.update({
      where: { id },
      data: {
        ...(date ? { date: new Date(date) } : {}),
        ...(total !== undefined ? { total } : {}),
      },
    });
  });

  return NextResponse.json({ ...act, total: Number(act.total) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  await prisma.act.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
