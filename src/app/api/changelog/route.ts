import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 50;

  const where = orderId ? { orderId } : {};

  const [logs, total] = await Promise.all([
    prisma.changeLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, role: true } },
        order: { select: { id: true, number: true } },
      },
    }),
    prisma.changeLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) });
}
