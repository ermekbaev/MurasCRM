import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitChatEvent } from "@/lib/chat-events";
import { extractAttachments, fetchAndStore } from "@/lib/telegram-chat";

/**
 * Приём входящих сообщений от Telegram.
 *
 * Точка публичная — Telegram приходит без нашей сессии. Защищена секретом,
 * который задаётся при подключении вебхука (secret_token) и приходит в
 * заголовке. Без совпадения секрета запрос отбрасывается.
 *
 * Отвечаем 200 почти всегда: на любой другой ответ Telegram повторяет доставку,
 * и одна кривая посылка встала бы в очередь перед всеми остальными.
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

  // business_message — переписка личного аккаунта, подключённого к боту через
  // Telegram Business. Пока ни у кого не подключено; разбираем сразу, чтобы
  // включение было настройкой, а не доработкой.
  const msg =
    update?.message ??
    update?.edited_message ??
    update?.business_message ??
    update?.edited_business_message;
  const isEdit = Boolean(update?.edited_message ?? update?.edited_business_message);
  const businessConnectionId: string | null = msg?.business_connection_id ?? null;

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
  const text: string = msg.text ?? msg.caption ?? "";
  const attachments = extractAttachments(msg);
  const messageExternalId = String(msg.message_id);

  try {
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
        ...(businessConnectionId ? { businessConnectionId } : {}),
        ...(client ? { clientId: client.id } : {}),
      },
      create: {
        channel: "TELEGRAM",
        externalId,
        title,
        username,
        businessConnectionId,
        lastMessageAt: new Date(),
        unread: 0,
        clientId: client?.id,
      },
    });

    // Telegram повторяет доставку, если не получил 200. Проверяем до загрузки
    // файлов, иначе повтор тянул бы вложение во второй раз.
    const existing = await prisma.message.findUnique({
      where: {
        conversationId_externalId: {
          conversationId: conversation.id,
          externalId: messageExternalId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      // Правка приходит тем же message_id — обновляем текст, счётчик не трогаем.
      if (isEdit) {
        await prisma.message.update({ where: { id: existing.id }, data: { text } });
        emitChatEvent({ conversationId: conversation.id, direction: "IN" });
      }
      return NextResponse.json({ ok: true });
    }

    const stored = await Promise.all(
      attachments.map(async (att) => {
        const result = await fetchAndStore(att, conversation.id);
        return {
          kind: att.kind,
          name: att.name,
          mimeType: att.mimeType,
          externalId: att.fileId,
          key: result.key,
          size: result.size,
          failReason: result.failReason,
        };
      }),
    );

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "IN",
        text,
        externalId: messageExternalId,
        ...(stored.length > 0 ? { attachments: { create: stored } } : {}),
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), unread: { increment: 1 } },
    });

    emitChatEvent({ conversationId: conversation.id, direction: "IN" });
  } catch (e) {
    // Логируем, но отвечаем 200: повторная доставка того же сбойного апдейта
    // заблокировала бы очередь обновлений целиком.
    console.error("telegram webhook", e);
  }

  return NextResponse.json({ ok: true });
}
