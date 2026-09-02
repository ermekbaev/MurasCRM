import { randomUUID } from "crypto";
import { putObject } from "@/lib/s3";
import type { AttachmentKind } from "@prisma/client";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FILE_BASE = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

/**
 * Bot API отдаёт файлы не больше 20 МБ — это ограничение Telegram, не наше.
 * Всё, что тяжелее, остаётся у клиента в переписке: мы сохраняем упоминание
 * файла и причину, по которой его нет, чтобы менеджер понимал, что произошло,
 * и попросил прислать макет через загрузку в заявку.
 */
export const TELEGRAM_MAX_DOWNLOAD = 20 * 1024 * 1024;

/** Отправлять можно больше, чем скачивать. */
export const TELEGRAM_MAX_UPLOAD = 50 * 1024 * 1024;

export interface IncomingAttachment {
  kind: AttachmentKind;
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
}

type TgFile = {
  file_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};

/** Разбирает входящее сообщение Telegram в список вложений. */
export function extractAttachments(
  msg: Record<string, unknown>,
): IncomingAttachment[] {
  const out: IncomingAttachment[] = [];
  const id = String(msg.message_id ?? "file");

  const push = (
    kind: AttachmentKind,
    f: TgFile | undefined,
    fallbackName: string,
    fallbackMime: string,
  ) => {
    if (!f?.file_id) return;
    out.push({
      kind,
      fileId: f.file_id,
      name: f.file_name || fallbackName,
      mimeType: f.mime_type || fallbackMime,
      size: f.file_size ?? 0,
    });
  };

  // Фото приходит несколькими размерами — берём самый крупный.
  const photo = msg.photo as TgFile[] | undefined;
  if (Array.isArray(photo) && photo.length > 0) {
    const largest = photo.reduce((a, b) => ((a.file_size ?? 0) > (b.file_size ?? 0) ? a : b));
    push("PHOTO", largest, `photo_${id}.jpg`, "image/jpeg");
  }

  push("DOCUMENT", msg.document as TgFile, `document_${id}`, "application/octet-stream");
  push("VOICE", msg.voice as TgFile, `voice_${id}.ogg`, "audio/ogg");
  push("VIDEO", msg.video as TgFile, `video_${id}.mp4`, "video/mp4");
  push("VIDEO", msg.video_note as TgFile, `video_${id}.mp4`, "video/mp4");
  push("VIDEO", msg.animation as TgFile, `animation_${id}.mp4`, "video/mp4");
  push("AUDIO", msg.audio as TgFile, `audio_${id}.mp3`, "audio/mpeg");
  push("STICKER", msg.sticker as TgFile, `sticker_${id}.webp`, "image/webp");

  return out;
}

/** Имя без путей и переносов — оно попадает в ключ хранилища и в заголовок. */
export function safeFileName(name: string): string {
  return name.replace(/[\/\r\n"]+/g, "_").slice(0, 180) || "file";
}

export interface StoredAttachment {
  key: string | null;
  size: number;
  failReason: string | null;
}

/**
 * Забирает файл у Telegram и кладёт в наше хранилище.
 *
 * Ошибку не бросаем: если файл не удалось получить, сообщение всё равно должно
 * попасть в переписку — потерять текст из-за сбоя загрузки хуже, чем показать
 * вложение с пометкой.
 */
export async function fetchAndStore(
  att: IncomingAttachment,
  conversationId: string,
): Promise<StoredAttachment> {
  if (!BOT_TOKEN) return { key: null, size: att.size, failReason: "Не задан токен бота" };

  if (att.size > TELEGRAM_MAX_DOWNLOAD) {
    return {
      key: null,
      size: att.size,
      failReason: `Файл больше ${TELEGRAM_MAX_DOWNLOAD / 1024 / 1024} МБ — Telegram не отдаёт такие ботам`,
    };
  }

  try {
    const info = await fetch(`${API_BASE}/getFile?file_id=${encodeURIComponent(att.fileId)}`)
      .then((r) => r.json() as Promise<{ ok: boolean; description?: string; result?: { file_path?: string; file_size?: number } }>);

    if (!info.ok || !info.result?.file_path) {
      return { key: null, size: att.size, failReason: info.description || "Telegram не отдал файл" };
    }

    const res = await fetch(`${FILE_BASE}/${info.result.file_path}`);
    if (!res.ok) {
      return { key: null, size: att.size, failReason: `Загрузка не удалась (${res.status})` };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > TELEGRAM_MAX_DOWNLOAD) {
      return { key: null, size: buffer.length, failReason: "Файл больше допустимого размера" };
    }

    const key = `chat/${conversationId}/${randomUUID()}-${safeFileName(att.name)}`;
    await putObject(key, buffer, att.mimeType);
    return { key, size: buffer.length, failReason: null };
  } catch (e) {
    return {
      key: null,
      size: att.size,
      failReason: e instanceof Error ? e.message : "Не удалось сохранить файл",
    };
  }
}

/**
 * Отправка текста собеседнику.
 *
 * businessConnectionId — задел под Telegram Business: с ним сообщение уходит
 * от лица личного аккаунта, без него от лица бота. Пока всегда пусто.
 */
export async function sendText(
  chatId: string,
  text: string,
  businessConnectionId?: string | null,
): Promise<void> {
  await call("sendMessage", {
    chat_id: chatId,
    text,
    ...(businessConnectionId ? { business_connection_id: businessConnectionId } : {}),
  });
}

/**
 * Отправка файла.
 *
 * Всё уходит через sendDocument, даже картинки: sendPhoto пережимает
 * изображение, а в типографии по такому файлу печатают.
 */
export async function sendFile(
  chatId: string,
  file: { buffer: Buffer; name: string; mimeType: string },
  caption: string | undefined,
  businessConnectionId?: string | null,
): Promise<void> {
  if (!BOT_TOKEN) throw new Error("Не задан TELEGRAM_BOT_TOKEN");

  const form = new FormData();
  form.append("chat_id", chatId);
  if (caption) form.append("caption", caption.slice(0, 1024));
  if (businessConnectionId) form.append("business_connection_id", businessConnectionId);
  form.append(
    "document",
    new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }),
    safeFileName(file.name),
  );

  const res = await fetch(`${API_BASE}/sendDocument`, { method: "POST", body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { description?: string } | null;
    throw new Error(body?.description || `Telegram ответил ${res.status}`);
  }
}

async function call(method: string, payload: Record<string, unknown>): Promise<void> {
  if (!BOT_TOKEN) throw new Error("Не задан TELEGRAM_BOT_TOKEN");

  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { description?: string } | null;
    throw new Error(body?.description || `Telegram ответил ${res.status}`);
  }
}
