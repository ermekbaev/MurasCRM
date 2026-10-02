import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

async function getSettings() {
  return (await prisma.companySettings.findFirst()) ?? (await prisma.companySettings.create({ data: {} }));
}

/** Статус голосовых запросов-отчётов. */
export async function GET() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  const s = await prisma.companySettings.findFirst({ select: { voiceQueriesEnabled: true } });
  return NextResponse.json({ enabled: s?.voiceQueriesEnabled ?? true });
}

const schema = z.object({ enabled: z.boolean() });

/** Включить/выключить голосовые запросы. */
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest("Ожидается enabled: true|false");

  const s = await getSettings();
  await prisma.companySettings.update({
    where: { id: s.id },
    data: { voiceQueriesEnabled: parsed.data.enabled },
  });
  return NextResponse.json({ enabled: parsed.data.enabled });
}
