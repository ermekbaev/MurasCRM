import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { slugifyOrderTypeCode } from "@/lib/orderTypes";

const schema = z.object({
  label: z.string().min(1).max(64),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const types = await prisma.orderTypeOption.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(types);
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Уникальный машинный код из названия
  const base = slugifyOrderTypeCode(parsed.data.label);
  let code = base;
  for (let i = 2; await prisma.orderTypeOption.findUnique({ where: { code } }); i++) {
    code = `${base}_${i}`;
  }

  const max = await prisma.orderTypeOption.aggregate({ _max: { sortOrder: true } });
  const type = await prisma.orderTypeOption.create({
    data: {
      code,
      label: parsed.data.label,
      isActive: parsed.data.isActive,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(type, { status: 201 });
}
