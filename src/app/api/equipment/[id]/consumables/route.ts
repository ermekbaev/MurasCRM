import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const upsertSchema = z.object({
  consumableId: z.string(),
  consumptionPerUnit: z.number().positive(),
  autoDeduct: z.boolean().default(true),
  trigger: z.enum(["MANUAL", "ON_IN_PROGRESS", "ON_READY"]).default("ON_IN_PROGRESS"),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const configs = await prisma.equipmentConsumable.findMany({
    where: { equipmentId: id },
    include: { consumable: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(configs);
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
  const { id: equipmentId } = await params;

  const body = await req.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const config = await prisma.equipmentConsumable.upsert({
    where: { equipmentId_consumableId: { equipmentId, consumableId: parsed.data.consumableId } },
    create: { equipmentId, ...parsed.data },
    update: parsed.data,
    include: { consumable: true },
  });

  return NextResponse.json(config);
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
  const { id: equipmentId } = await params;

  const { consumableId } = await req.json();

  await prisma.equipmentConsumable.delete({
    where: { equipmentId_consumableId: { equipmentId, consumableId } },
  });

  return NextResponse.json({ ok: true });
}
