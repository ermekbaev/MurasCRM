import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitChatEvent } from "@/lib/chat-events";
import {
  isWhatsappConfigured,
  whatsappVerifyToken,
  verifySignature,
  extractAttachments,
  extractText,
  fetchAndStore,
} from "@/lib/whatsapp";

/**
 * Подтверждение адреса при подключении в панели Meta.
 *
 * Meta один раз дёргает адрес обычным GET и ждёт обратно значение hub.challenge
 * — только после этого начинает слать сообщения.
 */
export async function GET(req: Request) {
  if (!isWhatsappConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const params = new URL(req.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === whatsappVerifyToken() && challenge) {
    // Ответ обязан быть голым числом: Meta сверяет тело целиком.
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Приём входящих сообщений WhatsApp.
 *
 * Точка публичная. В отличие от Telegram здесь нет секрета в заголовке: Meta
 * подписывает тело запроса ключом приложения, поэтому читаем сырое тело и
 * сверяем подпись до разбора.
 *
 * Отвечаем 200 почти всегда: на другой ответ Meta повторяет доставку, и одна
 * кривая посылка встала бы в очередь перед всеми остальными.
 */
export async function POST(req: Request) {
  if (!isWhatsappConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let update: unknown;
  try {
    update = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    for (const entry of asArray(update, "entry")) {
      for (const change of asArray(entry, "changes")) {
        const value = (change as Record<string, unknown>).value as
          | Record<string, unknown>
          | undefined;
        if (!value) continue;

        // statuses — отметки о доставке и прочтении наших сообщений. Пока не
        // показываем, но и не считаем ошибкой: они приходят на каждый ответ.
        const messages = asArray(value, "messages");
        if (messages.length === 0) continue;

        const metadata = value.metadata as { phone_number_id?: string } | undefined;
        const contacts = asArray(value, "contacts") as Array<{
          wa_id?: string;
          profile?: { name?: string };
        }>;

        for (const message of messages) {
          await handleMessage(
            message as Record<string, unknown>,
            contacts,
            metadata?.phone_number_id ?? null,
          );
        }
      }
    }
  } catch (e) {
    console.error("whatsapp webhook", e);
  }

  return NextResponse.json({ ok: true });
}

function asArray(source: unknown, key: string): unknown[] {
  const value = (source as Record<string, unknown> | null)?.[key];
  return Array.isArray(value) ? value : [];
}

async function handleMessage(
  msg: Record<string, unknown>,
  contacts: Array<{ wa_id?: string; profile?: { name?: string } }>,
  phoneNumberId: string | null,
) {
  // Номер клиента и есть идентификатор чата в WhatsApp.
  const externalId = String(msg.from ?? "");
  const messageId = String(msg.id ?? "");
  if (!externalId || !messageId) return;

  const contact = contacts.find((c) => c.wa_id === externalId) ?? contacts[0];
  const title = contact?.profile?.name || `+${externalId}`;
  const phone = `+${externalId}`;

  // Если номер есть в карточке клиента — сразу привязываем диалог. Сравниваем
  // по цифрам: в карточках номера записаны кто во что горазд.
  const digits = externalId.replace(/\D/g, "");
  const client = digits
    ? await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Client"
        WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = ${digits}
        LIMIT 1
      `
    : [];

  const conversation = await prisma.conversation.upsert({
    where: { channel_externalId: { channel: "WHATSAPP", externalId } },
    update: {
      title,
      phone,
      ...(phoneNumberId ? { accountId: phoneNumberId } : {}),
      ...(client[0] ? { clientId: client[0].id } : {}),
    },
    create: {
      channel: "WHATSAPP",
      externalId,
      title,
      phone,
      accountId: phoneNumberId,
      lastMessageAt: new Date(),
      unread: 0,
      clientId: client[0]?.id,
    },
  });

  // Meta повторяет доставку, если не получила 200. Проверяем до загрузки
  // файлов, иначе повтор тянул бы вложение во второй раз.
  const existing = await prisma.message.findUnique({
    where: {
      conversationId_externalId: { conversationId: conversation.id, externalId: messageId },
    },
    select: { id: true },
  });
  if (existing) return;

  const attachments = extractAttachments(msg);
  const stored = await Promise.all(
    attachments.map(async (att) => {
      const result = await fetchAndStore(att, conversation.id);
      return {
        kind: att.kind,
        name: att.name,
        mimeType: att.mimeType,
        externalId: att.mediaId,
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
      text: extractText(msg),
      externalId: messageId,
      ...(stored.length > 0 ? { attachments: { create: stored } } : {}),
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), unread: { increment: 1 } },
  });

  emitChatEvent({ conversationId: conversation.id, direction: "IN" });
}
