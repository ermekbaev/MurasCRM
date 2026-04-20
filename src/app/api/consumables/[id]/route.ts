import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["DTF_FILM", "UV_INK", "VINYL", "BANNER", "SUBSTRATE", "OTHER"]).optional(),
  unit: z.string().optional(),
  minStock: z.number().nonnegative().optional(),
  purchasePrice: z.number().nonnegative().optional(),
  writeoffPrice: z.number().nonnegative().optional(),
  supplierId: z.string().nullable().optional(),
  article: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const consumable = await prisma.consumable.update({
    where: { id },
    data: parsed.data,
    include: {
      supplier: { select: { id: true, name: true } },
      _count: { select: { movements: true } },
    },
  });

  return NextResponse.json({
    ...consumable,
    stock: Number(consumable.stock),
    minStock: Number(consumable.minStock),
    purchasePrice: Number(consumable.purchasePrice),
    writeoffPrice: Number(consumable.writeoffPrice),
    isLow: Number(consumable.stock) < Number(consumable.minStock),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.consumable.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
