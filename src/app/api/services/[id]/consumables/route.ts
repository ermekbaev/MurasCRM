import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addSchema = z.object({
  consumableId: z.string(),
  qtyPerUnit: z.number().positive(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const items = await prisma.serviceConsumable.findMany({
    where: { serviceId: id },
    include: { consumable: { select: { id: true, name: true, unit: true, writeoffPrice: true } } },
  });

  return NextResponse.json(items.map((i) => ({ ...i, qtyPerUnit: Number(i.qtyPerUnit) })));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: serviceId } = await params;
  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.serviceConsumable.findFirst({
    where: { serviceId, consumableId: parsed.data.consumableId },
  });
  if (existing) {
    const updated = await prisma.serviceConsumable.update({
      where: { id: existing.id },
      data: { qtyPerUnit: parsed.data.qtyPerUnit },
      include: { consumable: { select: { id: true, name: true, unit: true, writeoffPrice: true } } },
    });
    return NextResponse.json({ ...updated, qtyPerUnit: Number(updated.qtyPerUnit) });
  }

  const item = await prisma.serviceConsumable.create({
    data: { serviceId, ...parsed.data },
    include: { consumable: { select: { id: true, name: true, unit: true, writeoffPrice: true } } },
  });
  return NextResponse.json({ ...item, qtyPerUnit: Number(item.qtyPerUnit) }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const scId = searchParams.get("scId");
  if (!scId) return NextResponse.json({ error: "scId required" }, { status: 400 });

  await prisma.serviceConsumable.delete({ where: { id: scId } });
  return NextResponse.json({ ok: true });
}
