import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

function originOf(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host");
  return `${proto}://${host}`;
}

async function getSettings() {
  return (await prisma.companySettings.findFirst()) ?? (await prisma.companySettings.create({ data: {} }));
}

/** Статус навыка Алисы и URL вебхука для вставки в Яндекс.Диалоги. */
export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  const s = await prisma.companySettings.findFirst({ select: { aliceSecret: true } });
  const enabled = Boolean(s?.aliceSecret);
  return NextResponse.json({
    enabled,
    url: enabled ? `${originOf(req)}/api/alice/webhook?key=${s!.aliceSecret}` : null,
  });
}

/** Включить навык: сгенерировать секрет и отдать URL вебхука. */
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  const s = await getSettings();
  const secret = s.aliceSecret || randomBytes(24).toString("hex");
  if (!s.aliceSecret) {
    await prisma.companySettings.update({ where: { id: s.id }, data: { aliceSecret: secret } });
  }
  return NextResponse.json({ enabled: true, url: `${originOf(req)}/api/alice/webhook?key=${secret}` });
}

/** Выключить навык. */
export async function DELETE() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  const s = await prisma.companySettings.findFirst();
  if (s) await prisma.companySettings.update({ where: { id: s.id }, data: { aliceSecret: null } });
  return NextResponse.json({ ok: true });
}
