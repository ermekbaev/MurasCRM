import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { tgApi, setWebhook, deleteWebhook, getWebhookInfo } from "@/lib/telegram";
import { z } from "zod";

function originOf(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host");
  return `${proto}://${host}`;
}

async function getSettings() {
  return (await prisma.companySettings.findFirst()) ?? (await prisma.companySettings.create({ data: {} }));
}

/** Статус подключения бота. */
export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  const s = await prisma.companySettings.findFirst({ select: { telegramBotToken: true } });
  const token = s?.telegramBotToken;
  if (!token) return NextResponse.json({ configured: false, webhookUrl: `${originOf(req)}/api/telegram/webhook` });

  const me = (await tgApi("getMe", {}, token)) as { ok: boolean; result?: { username?: string } } | null;
  const info = (await getWebhookInfo(token)) as { ok: boolean; result?: { url?: string; last_error_message?: string; pending_update_count?: number } } | null;
  return NextResponse.json({
    configured: true,
    username: me?.result?.username ?? null,
    webhook: info?.result ?? null,
  });
}

const postSchema = z.object({ token: z.string().min(20) });

/** Сохранить токен и зарегистрировать вебхук. */
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest("Укажите токен бота");
  const token = parsed.data.token.trim();

  const me = (await tgApi("getMe", {}, token)) as { ok: boolean; result?: { username?: string } } | null;
  if (!me?.ok) return apiError.badRequest("Неверный токен — Telegram не принял его");

  const s = await getSettings();
  const secret = s.telegramSecret || randomBytes(24).toString("hex");
  const url = `${originOf(req)}/api/telegram/webhook`;

  const wh = (await setWebhook(url, secret, token)) as { ok: boolean; description?: string } | null;
  if (!wh?.ok) return apiError.badRequest(wh?.description || "Не удалось зарегистрировать вебхук");

  await prisma.companySettings.update({
    where: { id: s.id },
    data: { telegramBotToken: token, telegramSecret: secret },
  });
  return NextResponse.json({ ok: true, username: me.result?.username ?? null });
}

/** Отключить бота. */
export async function DELETE() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  const s = await prisma.companySettings.findFirst();
  if (s?.telegramBotToken) await deleteWebhook(s.telegramBotToken);
  if (s) {
    await prisma.companySettings.update({
      where: { id: s.id },
      data: { telegramBotToken: null, telegramSecret: null },
    });
  }
  return NextResponse.json({ ok: true });
}
