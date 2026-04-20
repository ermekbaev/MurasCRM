import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["DTF", "UV_DTF", "UV_FLATBED", "LASER_CUT", "PLOTTER_CUT", "HIGH_PRECISION", "COMBO"]).nullable().optional(),
  unit: z.string().optional(),
  price: z.number().nonnegative().optional(),
  equipmentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      equipment: { select: { id: true, name: true } },
      consumables: {
        include: { consumable: { select: { id: true, name: true, unit: true } } },
      },
    },
  });

  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...service, price: Number(service.price) });
}

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

  const service = await prisma.service.update({
    where: { id },
    data: parsed.data,
    include: { equipment: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ ...service, price: Number(service.price) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.service.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
