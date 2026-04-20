import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional(),
  workWidth: z.number().nullable().optional(),
  pricePerLm: z.number().nullable().optional(),
  pricingUnit: z.enum(["LM", "SQM", "PCS", "CUT"]).optional(),
  materials: z.array(z.string()).optional(),
  status: z.enum(["ACTIVE", "MAINTENANCE"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const equipment = await prisma.equipment.update({
    where: { id },
    data: parsed.data,
    include: { _count: { select: { services: true } } },
  });

  return NextResponse.json({
    ...equipment,
    workWidth: equipment.workWidth ? Number(equipment.workWidth) : null,
    pricePerLm: equipment.pricePerLm ? Number(equipment.pricePerLm) : null,
    pricingUnit: equipment.pricingUnit || "LM",
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.equipment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
