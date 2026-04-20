import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(["DTF_FILM", "UV_INK", "VINYL", "BANNER", "SUBSTRATE", "OTHER"]).default("OTHER"),
  unit: z.string(),
  stock: z.number().nonnegative().default(0),
  minStock: z.number().nonnegative().default(0),
  purchasePrice: z.number().nonnegative().default(0),
  writeoffPrice: z.number().nonnegative().default(0),
  supplierId: z.string().optional(),
  article: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const lowStock = searchParams.get("lowStock") === "true";
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { article: { contains: search, mode: "insensitive" } },
    ];
  }

  const consumables = await prisma.consumable.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      supplier: { select: { id: true, name: true } },
      _count: { select: { movements: true } },
    },
  });

  const result = consumables
    .map((c) => ({
      ...c,
      stock: Number(c.stock),
      minStock: Number(c.minStock),
      purchasePrice: Number(c.purchasePrice),
      writeoffPrice: Number(c.writeoffPrice),
      isLow: Number(c.stock) < Number(c.minStock),
    }))
    .filter((c) => !lowStock || c.isLow);

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const consumable = await prisma.consumable.create({ data: parsed.data });
  return NextResponse.json(consumable, { status: 201 });
}
