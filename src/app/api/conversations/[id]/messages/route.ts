import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sendMessageOrThrow } from "@/lib/telegram";
import { z } from "zod";

const CHAT_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT", "DESIGNER"];

const schema = z.object({ text: z.string().min(1).max(4000) });

/** Ответ клиенту: сначала отправляем в мессенджер, потом пишем в историю. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CHAT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation) return apiError.notFound();

  if (conversation.channel !== "TELEGRAM") {
    return apiError.badRequest("Отправка поддерживается только для Telegram");
  }

  // Порядок важен: не записываем в историю то, что не ушло собеседнику.
  try {
    await sendMessageOrThrow(conversation.externalId, parsed.data.text);
  } catch (e) {
    const reason = e instanceof Error ? e.message : "";
    return NextResponse.json(
      {
        error: reason
          ? `Telegram не принял сообщение: ${reason}`
          : "Telegram не принял сообщение — возможно, клиент заблокировал бота",
      },
      { status: 502 },
    );
  }

  const message = await prisma.message.create({
    data: {
      conversationId: id,
      direction: "OUT",
      text: parsed.data.text,
      userId: session.user.id,
      userName: session.user.name ?? null,
    },
  });

  await prisma.conversation.update({
    where: { id },
    data: { lastMessageAt: new Date() },
  });

  return NextResponse.json(message, { status: 201 });
}
