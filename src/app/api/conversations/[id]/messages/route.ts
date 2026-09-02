import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { putObject } from "@/lib/s3";
import { CHAT_ROLES } from "@/lib/chat-roles";
import { sendText, sendFile, safeFileName } from "@/lib/telegram-chat";
import { emitChatEvent } from "@/lib/chat-events";
import { randomUUID } from "crypto";
import type { AttachmentKind } from "@prisma/client";

/**
 * Telegram принимает документы до 50 МБ, но файл проходит через память нашего
 * процесса, а сервер небольшой. 20 МБ — и симметрично лимиту на приём, что
 * проще объяснить пользователю: «до 20 МБ в обе стороны».
 */
const MAX_UPLOAD = 20 * 1024 * 1024;

const MAX_TEXT = 4000;

function kindFor(mimeType: string): AttachmentKind {
  if (mimeType.startsWith("image/")) return "PHOTO";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return "DOCUMENT";
}

/** Ответ клиенту: сначала отправляем в мессенджер, потом пишем в историю. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CHAT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation) return apiError.notFound();
  if (conversation.channel !== "TELEGRAM") {
    return apiError.badRequest("Отправка поддерживается только для Telegram");
  }

  let text = "";
  let upload: File | null = null;

  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    text = String(form?.get("text") ?? "").trim();
    const file = form?.get("file");
    upload = file instanceof File && file.size > 0 ? file : null;
  } else {
    const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
    text = typeof body?.text === "string" ? body.text.trim() : "";
  }

  if (!text && !upload) return apiError.badRequest("Пустое сообщение");
  if (text.length > MAX_TEXT) {
    return apiError.badRequest(`Текст длиннее ${MAX_TEXT} символов`);
  }
  if (upload && upload.size > MAX_UPLOAD) {
    return apiError.badRequest(
      `Файл больше ${MAX_UPLOAD / 1024 / 1024} МБ — пришлите его через файлы заявки`,
    );
  }

  const buffer = upload ? Buffer.from(await upload.arrayBuffer()) : null;
  const mimeType = upload?.type || "application/octet-stream";

  // Порядок важен: не записываем в историю то, что не ушло собеседнику.
  try {
    if (buffer && upload) {
      await sendFile(
        conversation.externalId,
        { buffer, name: upload.name, mimeType },
        text || undefined,
        conversation.businessConnectionId,
      );
    } else {
      await sendText(conversation.externalId, text, conversation.businessConnectionId);
    }
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

  // Файл уже у клиента. Если сохранить копию не вышло, сообщение всё равно
  // должно попасть в историю — с пометкой, что вложения у нас нет.
  let stored: { key: string | null; failReason: string | null } = {
    key: null,
    failReason: null,
  };
  if (buffer && upload) {
    try {
      const key = `chat/${conversation.id}/${randomUUID()}-${safeFileName(upload.name)}`;
      await putObject(key, buffer, mimeType);
      stored = { key, failReason: null };
    } catch (e) {
      stored = {
        key: null,
        failReason: e instanceof Error ? e.message : "Не удалось сохранить копию",
      };
    }
  }

  const message = await prisma.message.create({
    data: {
      conversationId: id,
      direction: "OUT",
      text,
      userId: session.user.id,
      userName: session.user.name ?? null,
      ...(upload && buffer
        ? {
            attachments: {
              create: {
                kind: kindFor(mimeType),
                name: safeFileName(upload.name),
                mimeType,
                size: buffer.length,
                key: stored.key,
                failReason: stored.failReason,
              },
            },
          }
        : {}),
    },
    include: {
      attachments: {
        select: {
          id: true,
          kind: true,
          name: true,
          mimeType: true,
          size: true,
          key: true,
          failReason: true,
        },
      },
    },
  });

  await prisma.conversation.update({
    where: { id },
    data: { lastMessageAt: new Date() },
  });

  emitChatEvent({ conversationId: id, direction: "OUT" });

  return NextResponse.json(
    {
      ...message,
      attachments: message.attachments.map((a) => ({
        ...a,
        key: undefined,
        available: Boolean(a.key),
      })),
    },
    { status: 201 },
  );
}
