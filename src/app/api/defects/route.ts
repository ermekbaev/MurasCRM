import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  equipmentId: z.string().min(1),
  orderId: z.string().optional().nullable(),
  qty: z.number().positive(),
  unit: z.string().min(1),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const operatorId = searchParams.get("operatorId");
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};

  if (session.user.role === "OPERATOR") {
    where.operatorId = session.user.id;
  } else if (operatorId) {
    where.operatorId = operatorId;
  }

  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const records = await prisma.defectRecord.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      equipment: { select: { id: true, name: true, pricingUnit: true } },
      operator: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      order: { select: { id: true, number: true } },
    },
    take: 200,
  });

  return NextResponse.json(
    records.map((r) => ({ ...r, qty: Number(r.qty), cost: Number(r.cost) }))
  );
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const equipment = await prisma.equipment.findUnique({
    where: { id: parsed.data.equipmentId },
    select: { costPerLm: true },
  });
  if (!equipment) return NextResponse.json({ error: "Equipment not found" }, { status: 404 });

  const costPerLm = equipment.costPerLm ? Number(equipment.costPerLm) : 0;
  const cost = costPerLm * parsed.data.qty;

  const record = await prisma.defectRecord.create({
    data: {
      equipmentId: parsed.data.equipmentId,
      operatorId: session.user.id,
      orderId: parsed.data.orderId || null,
      qty: parsed.data.qty,
      unit: parsed.data.unit,
      reason: parsed.data.reason || null,
      notes: parsed.data.notes || null,
      cost,
    },
    include: {
      equipment: { select: { id: true, name: true, pricingUnit: true } },
      operator: { select: { id: true, name: true } },
      order: { select: { id: true, number: true } },
    },
  });

  return NextResponse.json({ ...record, qty: Number(record.qty), cost: Number(record.cost) }, { status: 201 });
}
