import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";

// Публичный POST: фиксируем заход в демо по метке ?ref=. Без метки не пишем,
// чтобы не логировать обычные заходы и ботов.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const ref = typeof body?.ref === "string" ? body.ref.trim().slice(0, 64) : "";
    if (!ref) return NextResponse.json({ ok: true });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 255) || null;

    await prisma.demoVisit.create({ data: { ref, ip, userAgent } });
    return NextResponse.json({ ok: true });
  } catch {
    // трекинг не должен ломать страницу
    return NextResponse.json({ ok: true });
  }
}

// GET (только ADMIN): последние заходы, чтобы смотреть прямо в системе.
export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const visits = await prisma.demoVisit.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(visits);
}
