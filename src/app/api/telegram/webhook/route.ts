import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/telegram";
import { executeVoiceCommand, VOICE_HELP } from "@/lib/voice-run.server";

export const dynamic = "force-dynamic";

/**
 * Входящие команды от сотрудников через Telegram-бота: «задача …», «клиент …».
 *
 * Кто пишет — определяем по telegramChatId пользователя (привязывается по коду).
 * Незнакомым и заблокированным ничего не создаём. Живой запуск требует
 * бот-токена и регистрации вебхука; разбор и создание работают независимо.
 */

const HELP = VOICE_HELP;

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: Request) {
  // Секрет вебхука из настроек (fallback — env). Telegram шлёт его заголовком.
  const settings = await prisma.companySettings.findFirst({ select: { telegramSecret: true } });
  const secret = settings?.telegramSecret || process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }

  const update = await req.json().catch(() => null);
  const message = update?.message ?? update?.edited_message;
  const chatId = message?.chat?.id != null ? String(message.chat.id) : null;
  if (!chatId) return NextResponse.json({ ok: true });

  // Голосовое аудио пока не распознаём — просим текст/диктовку.
  if ((message.voice || message.audio) && !message.text) {
    await sendMessage(
      chatId,
      "Голосовые аудио пока не распознаю. Наберите команду текстом — на телефоне можно надиктовать микрофоном клавиатуры. /help — примеры.",
    );
    return NextResponse.json({ ok: true });
  }

  const text: string = (message.text ?? "").trim();
  if (!text) return NextResponse.json({ ok: true });

  // Привязка аккаунта по коду — до проверки «кто пишет», иначе непривязанный
  // сотрудник не сможет привязаться. Код выдаёт админ в Настройках. Принимаем
  // и «код XXXX», и просто присланный код из 6 символов.
  const link = text.match(/^\/?(?:link|привяжи|привязать|код)(?:\s+код)?\s+(\S+)/i);
  const bare = !link && /^[A-Za-z2-9]{6}$/.test(text) ? text : null;
  if (link || bare) {
    const code = (link ? link[1] : bare)!;
    const target = await prisma.user.findFirst({
      where: { linkCode: { equals: code, mode: "insensitive" }, isBlocked: false },
    });
    if (!target) {
      await sendMessage(chatId, "Код не найден или устарел. Попросите администратора выдать новый.");
      return NextResponse.json({ ok: true });
    }
    await prisma.user.update({
      where: { id: target.id },
      data: { telegramChatId: chatId, linkCode: null },
    });
    await sendMessage(chatId, `✅ Готово, ${esc(target.name)}. Ваш Telegram привязан. Пишите «задача …» или «клиент …». /help — примеры.`);
    return NextResponse.json({ ok: true });
  }

  if (/^\/start\b/i.test(text)) {
    await sendMessage(
      chatId,
      "Это бот CRM для сотрудников. Чтобы привязать аккаунт, возьмите код у администратора (Настройки → Бот и голос) и пришлите: «код ВАШ_КОД».",
    );
    return NextResponse.json({ ok: true });
  }

  // Кто пишет — только привязанный и не заблокированный сотрудник.
  const user = await prisma.user.findFirst({
    where: { telegramChatId: chatId, isBlocked: false },
    select: { id: true, name: true, role: true },
  });
  if (!user) {
    await sendMessage(
      chatId,
      "Ваш Telegram не привязан к аккаунту в CRM. Возьмите код привязки у администратора и пришлите: «код ВАШ_КОД».",
    );
    return NextResponse.json({ ok: true });
  }

  const result = await executeVoiceCommand(text, user);

  let reply: string;
  switch (result.kind) {
    case "help":
      reply = HELP;
      break;
    case "unknown":
      reply = "Не понял команду. Начните со слова «задача» или «клиент».\n\n" + HELP;
      break;
    case "need":
      reply = result.message;
      break;
    case "task":
      reply = `✅ Задача создана: <b>${esc(result.title)}</b>`;
      if (result.assigneeName) reply += `\n👤 Исполнитель: ${esc(result.assigneeName)}`;
      else if (result.assigneeMiss) reply += `\n⚠️ Сотрудник «${esc(result.assigneeMiss)}» не найден — задача без исполнителя`;
      if (result.dueDate) reply += `\n📅 Срок: ${result.dueDate.toLocaleDateString("ru-RU")}`;
      reply += `\n🔗 /tasks/${result.id}`;
      break;
    case "client":
      reply = `✅ Клиент добавлен: <b>${esc(result.name)}</b>`;
      if (result.phone) reply += `\n📞 ${esc(result.phone)}`;
      if (result.inn) reply += `\n🏢 ИНН ${esc(result.inn)}`;
      if (result.email) reply += `\n✉️ ${esc(result.email)}`;
      reply += `\n🔗 /clients/${result.id}`;
      break;
  }

  await sendMessage(chatId, reply);
  return NextResponse.json({ ok: true });
}
