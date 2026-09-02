import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Приём входящих сообщений от Telegram.
 *
 * Точка публичная — Telegram приходит без нашей сессии. Защищена секретом,
 * который задаётся при подключении вебхука (secret_token) и приходит в
 * заголовке. Без совпадения секрета запрос отбрасывается.
 */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    // Без секрета точку не открываем: иначе писать в неё сможет кто угодно.
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update = await req.json().catch(() => null);
  const msg = update?.message ?? update?.edited_message;
  const chat = msg?.chat;
  if (!msg || !chat?.id) return NextResponse.json({ ok: true });

  // Реагируем только на личную переписку: группы и каналы нам не нужны.
  if (chat.type !== "private") return NextResponse.json({ ok: true });

  const externalId = String(chat.id);
  const title =
    [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
    chat.username ||
    externalId;
  const username = chat.username ? `@${chat.username}` : null;
  const text: string = msg.text ?? msg.caption ?? "[вложение]";

  // Если в карточке клиента указан этот телеграм — сразу привязываем диалог.
  const client = username
    ? await prisma.client.findFirst({
        where: { telegram: { in: [username, username.slice(1)] } },
        select: { id: true },
      })
    : null;

  const conversation = await prisma.conversation.upsert({
    where: { channel_externalId: { channel: "TELEGRAM", externalId } },
    update: {
      title,
      username,
      lastMessageAt: new Date(),
      unread: { increment: 1 },
      ...(client ? { clientId: client.id } : {}),
    },
    create: {
      channel: "TELEGRAM",
      externalId,
      title,
      username,
      lastMessageAt: new Date(),
      unread: 1,
      clientId: client?.id,
    },
  });

  // Telegram повторяет доставку, если не получил 200 — уникальный индекс
  // не даст записать одно и то же сообщение дважды.
  await prisma.message
    .create({
      data: {
        conversationId: conversation.id,
        direction: "IN",
        text,
        externalId: String(msg.message_id),
      },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
