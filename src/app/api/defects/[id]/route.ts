import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  qty: z.number().positive().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.defectRecord.findUnique({
    where: { id },
    include: { equipment: { select: { costPerLm: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = existing.operatorId === session.user.id;
  const isManager = ["ADMIN", "MANAGER"].includes(session.user.role);

  if (!isOwner && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Only managers can approve/reject
  if (parsed.data.status && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Operators can only edit PENDING records they own
  if (!isManager && existing.status !== "PENDING") {
    return NextResponse.json({ error: "Нельзя редактировать подтверждённую запись" }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.reason !== undefined) updateData.reason = parsed.data.reason;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  if (parsed.data.qty !== undefined) {
    updateData.qty = parsed.data.qty;
    const costPerLm = existing.equipment.costPerLm ? Number(existing.equipment.costPerLm) : 0;
    updateData.cost = costPerLm * parsed.data.qty;
  }

  if (parsed.data.status) {
    updateData.status = parsed.data.status;
    updateData.approvedById = parsed.data.status === "APPROVED" ? session.user.id : null;
  }

  const record = await prisma.defectRecord.update({
    where: { id },
    data: updateData,
    include: {
      equipment: { select: { id: true, name: true, pricingUnit: true } },
      operator: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      order: { select: { id: true, number: true } },
    },
  });

  return NextResponse.json({ ...record, qty: Number(record.qty), cost: Number(record.cost) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.defectRecord.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = existing.operatorId === session.user.id && existing.status === "PENDING";
  const isAdmin = session.user.role === "ADMIN";

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.defectRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
