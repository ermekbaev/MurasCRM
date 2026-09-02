import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { putObject } from "@/lib/s3";
import { safeFileName } from "@/lib/telegram-chat";
import type { AttachmentKind } from "@prisma/client";

/**
 * WhatsApp Cloud API — официальный канал Meta.
 *
 * Неофициальные библиотеки, которые притворяются телефоном, здесь не
 * используются намеренно: за них блокируют номер, а номер у клиента рабочий.
 *
 * Версию Graph API выносим в настройку: Meta выводит старые версии из
 * обращения примерно раз в два года, и это не повод править код.
 */
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

const TOKEN = process.env.WHATSAPP_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const DEFAULT_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

/**
 * Свободно писать клиенту можно только 24 часа после его последнего сообщения.
 * Это правило Meta, а не наше: позже разрешены лишь заранее одобренные шаблоны,
 * и они платные. Считаем окно у себя, чтобы менеджер видел запрет заранее,
 * а не ловил отказ Meta после того, как набрал ответ.
 */
export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Ограничение наше, а не Meta: файл проходит через память процесса, сервер
 * небольшой. Цифра совпадает с Telegram, чтобы пользователю можно было сказать
 * просто «до 20 МБ в обе стороны».
 */
export const WHATSAPP_MAX_FILE = 20 * 1024 * 1024;

/** Канал включён только когда заданы все четыре настройки. */
export function isWhatsappConfigured(): boolean {
  return Boolean(TOKEN && APP_SECRET && VERIFY_TOKEN);
}

export function whatsappVerifyToken(): string | undefined {
  return VERIFY_TOKEN;
}

/**
 * Проверка подписи входящего запроса.
 *
 * Точка приёма публичная, и в отличие от Telegram здесь нет секрета в
 * заголовке — Meta подписывает тело запроса ключом приложения. Сравниваем в
 * постоянном времени: обычное сравнение строк подсказывает злоумышленнику,
 * сколько символов он угадал.
 */
export function verifySignature(rawBody: string, header: string | null): boolean {
  if (!APP_SECRET || !header) return false;

  const expected = "sha256=" + createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface WhatsappAttachment {
  kind: AttachmentKind;
  mediaId: string;
  name: string;
  mimeType: string;
}

type WaMedia = {
  id?: string;
  mime_type?: string;
  filename?: string;
  voice?: boolean;
};

/** Разбирает входящее сообщение WhatsApp в список вложений. */
export function extractAttachments(msg: Record<string, unknown>): WhatsappAttachment[] {
  const out: WhatsappAttachment[] = [];
  const id = String(msg.id ?? "file").slice(-12);

  const push = (
    kind: AttachmentKind,
    media: WaMedia | undefined,
    fallbackName: string,
    fallbackMime: string,
  ) => {
    if (!media?.id) return;
    out.push({
      kind,
      mediaId: media.id,
      name: media.filename || fallbackName,
      mimeType: media.mime_type || fallbackMime,
    });
  };

  push("PHOTO", msg.image as WaMedia, `photo_${id}.jpg`, "image/jpeg");
  push("DOCUMENT", msg.document as WaMedia, `document_${id}`, "application/octet-stream");
  push("VOICE", msg.audio as WaMedia, `voice_${id}.ogg`, "audio/ogg");
  push("VIDEO", msg.video as WaMedia, `video_${id}.mp4`, "video/mp4");
  push("STICKER", msg.sticker as WaMedia, `sticker_${id}.webp`, "image/webp");

  return out;
}

/** Текст сообщения: у каждого типа он лежит в своём поле. */
export function extractText(msg: Record<string, unknown>): string {
  const pick = (v: unknown): string =>
    typeof v === "object" && v !== null && "body" in v
      ? String((v as { body?: unknown }).body ?? "")
      : "";

  const caption = (v: unknown): string =>
    typeof v === "object" && v !== null && "caption" in v
      ? String((v as { caption?: unknown }).caption ?? "")
      : "";

  return (
    pick(msg.text) ||
    caption(msg.image) ||
    caption(msg.document) ||
    caption(msg.video) ||
    pick(msg.button) ||
    ""
  );
}

export interface StoredMedia {
  key: string | null;
  size: number;
  failReason: string | null;
}

/**
 * Забирает файл из WhatsApp и кладёт в наше хранилище.
 *
 * Размер заранее неизвестен: в отличие от Telegram во входящем сообщении его
 * нет, он приходит только вместе со ссылкой. Поэтому проверяем после запроса
 * сведений и до самой загрузки.
 *
 * Ошибку не бросаем: потерять текст сообщения из-за сбоя загрузки хуже, чем
 * показать вложение с пометкой.
 */
export async function fetchAndStore(
  att: WhatsappAttachment,
  conversationId: string,
): Promise<StoredMedia> {
  if (!TOKEN) return { key: null, size: 0, failReason: "Не задан WHATSAPP_TOKEN" };

  const auth = { Authorization: `Bearer ${TOKEN}` };

  try {
    const info = (await fetch(`${GRAPH}/${att.mediaId}`, { headers: auth }).then((r) =>
      r.json(),
    )) as {
      url?: string;
      file_size?: number;
      mime_type?: string;
      error?: { message?: string };
    };

    if (!info.url) {
      return { key: null, size: 0, failReason: info.error?.message || "WhatsApp не отдал файл" };
    }

    const size = Number(info.file_size ?? 0);
    if (size > WHATSAPP_MAX_FILE) {
      return {
        key: null,
        size,
        failReason: `Файл больше ${WHATSAPP_MAX_FILE / 1024 / 1024} МБ — не сохраняем`,
      };
    }

    // Ссылка на файл тоже требует токен: без заголовка Meta вернёт отказ.
    const res = await fetch(info.url, { headers: auth });
    if (!res.ok) {
      return { key: null, size, failReason: `Загрузка не удалась (${res.status})` };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > WHATSAPP_MAX_FILE) {
      return { key: null, size: buffer.length, failReason: "Файл больше допустимого размера" };
    }

    const key = `chat/${conversationId}/${randomUUID()}-${safeFileName(att.name)}`;
    await putObject(key, buffer, info.mime_type || att.mimeType);
    return { key, size: buffer.length, failReason: null };
  } catch (e) {
    return {
      key: null,
      size: 0,
      failReason: e instanceof Error ? e.message : "Не удалось сохранить файл",
    };
  }
}

/** Отправка текста. */
export async function sendText(to: string, text: string, phoneId?: string | null): Promise<void> {
  await send(phoneId, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    // Отключаем предпросмотр ссылок: в ответах менеджера это чаще мусор.
    text: { body: text, preview_url: false },
  });
}

/**
 * Отправка файла.
 *
 * Сначала кладём файл в хранилище Meta, потом отправляем по идентификатору.
 * Второй путь — передать Meta прямую ссылку — нам не подходит: наше хранилище
 * закрытое, а раздавать макеты клиентов по открытым адресам нельзя.
 *
 * Всё уходит документом, даже картинки: WhatsApp пережимает изображения, а по
 * этим файлам печатают.
 */
export async function sendFile(
  to: string,
  file: { buffer: Buffer; name: string; mimeType: string },
  caption: string | undefined,
  phoneId?: string | null,
): Promise<void> {
  const id = phoneId || DEFAULT_PHONE_ID;
  if (!TOKEN || !id) throw new Error("WhatsApp не настроен");

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", file.mimeType);
  form.append(
    "file",
    new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }),
    safeFileName(file.name),
  );

  const uploaded = await fetch(`${GRAPH}/${id}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  });
  const uploadBody = (await uploaded.json().catch(() => null)) as
    | { id?: string; error?: { message?: string } }
    | null;

  if (!uploaded.ok || !uploadBody?.id) {
    throw new Error(uploadBody?.error?.message || `WhatsApp ответил ${uploaded.status}`);
  }

  await send(id, {
    messaging_product: "whatsapp",
    to,
    type: "document",
    document: {
      id: uploadBody.id,
      filename: safeFileName(file.name),
      ...(caption ? { caption: caption.slice(0, 1024) } : {}),
    },
  });
}

async function send(phoneId: string | null | undefined, payload: unknown): Promise<void> {
  const id = phoneId || DEFAULT_PHONE_ID;
  if (!TOKEN || !id) throw new Error("WhatsApp не настроен");

  const res = await fetch(`${GRAPH}/${id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(body?.error?.message || `WhatsApp ответил ${res.status}`);
  }
}
