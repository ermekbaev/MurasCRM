import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(["DTF", "UV_DTF", "UV_FLATBED", "LASER_CUT", "PLOTTER_CUT", "HIGH_PRECISION", "COMBO"]).optional(),
  unit: z.string(),
  price: z.number().nonnegative(),
  equipmentId: z.string().optional(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const services = await prisma.service.findMany({
    orderBy: { name: "asc" },
    include: { equipment: { select: { id: true, name: true } } },
  });

  return NextResponse.json(services.map((s) => ({ ...s, price: Number(s.price) })));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const service = await prisma.service.create({
    data: { ...parsed.data, equipmentId: parsed.data.equipmentId || undefined },
  });

  return NextResponse.json(service, { status: 201 });
}
