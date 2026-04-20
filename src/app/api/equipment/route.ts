import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  type: z.string(),
  workWidth: z.number().nullable().optional(),
  pricePerLm: z.number().nullable().optional(),
  pricingUnit: z.enum(["LM", "SQM", "PCS", "CUT"]).default("LM"),
  materials: z.array(z.string()).default([]),
  status: z.enum(["ACTIVE", "MAINTENANCE"]).default("ACTIVE"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const equipment = await prisma.equipment.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { services: true } } },
  });

  return NextResponse.json(equipment.map((e) => ({
    ...e,
    workWidth: e.workWidth ? Number(e.workWidth) : null,
    pricePerLm: e.pricePerLm ? Number(e.pricePerLm) : null,
    pricingUnit: e.pricingUnit || "LM",
  })));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const equipment = await prisma.equipment.create({ data: parsed.data });
  return NextResponse.json(equipment, { status: 201 });
}
