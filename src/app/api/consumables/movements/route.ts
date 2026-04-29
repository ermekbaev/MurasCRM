import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { notifyLowStock } from "@/lib/telegram";

const movementSchema = z.object({
  consumableId: z.string().min(1),
  direction: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  qty: z.number().positive(),
  orderId: z.string().optional(),
  note: z.string().optional(),
  totalCost: z.number().optional(),
});

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const consumableId = searchParams.get("consumableId") || "";

  const movements = await prisma.consumableMovement.findMany({
    where: consumableId ? { consumableId } : {},
    orderBy: { date: "desc" },
    include: {
      consumable: { select: { name: true, unit: true } },
    },
    take: 200,
  });

  return NextResponse.json(
    movements.map((m) => ({
      ...m,
      qty: Number(m.qty),
      totalCost: m.totalCost ? Number(m.totalCost) : null,
    }))
  );
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = movementSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { consumableId, direction, qty, ...rest } = parsed.data;

  // Update stock
  const stockDelta = direction === "IN" ? qty : direction === "OUT" ? -qty : qty;

  const [movement] = await prisma.$transaction([
    prisma.consumableMovement.create({
      data: { consumableId, direction, qty, ...rest },
    }),
    prisma.consumable.update({
      where: { id: consumableId },
      data: { stock: { increment: stockDelta } },
    }),
  ]);

  if (direction === "OUT" || direction === "ADJUSTMENT") {
    notifyLowStock(consumableId).catch(console.error);
  }

  return NextResponse.json(movement, { status: 201 });
}
