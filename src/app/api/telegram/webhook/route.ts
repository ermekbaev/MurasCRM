import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/telegram";
import { getTaskColumns } from "@/lib/taskColumns.server";
import { parseVoiceCommand } from "@/lib/voice-command";

export const dynamic = "force-dynamic";

/**
 * Входящие команды от сотрудников через Telegram-бота: «задача …», «клиент …».
 *
 * Кто пишет — определяем по telegramChatId пользователя (сотрудник заранее
 * привязал свой Telegram). Незнакомым и заблокированным ничего не создаём.
 * Живой запуск требует бот-токена и регистрации вебхука; логика ниже работает
 * и тестируется независимо от этого.
 */

const HELP =
  "Что умею:\n" +
  "• Задача: «задача напечатать баннер для Васи к пятнице»\n" +
  "• Клиент: «клиент Иван Петров, телефон +7 900 111-22-33, инн 7701234567»\n\n" +
  "Срок можно словами: сегодня, завтра, к пятнице, через 3 дня, 5 октября, до 05.10.";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Сопоставляет подсказку-имя с активным сотрудником (по имени, регистронезависимо). */
function matchUser(
  hint: string,
  users: { id: string; name: string }[],
): { id: string; name: string } | null {
  const h = hint.trim().toLowerCase();
  if (!h) return null;
  return (
    users.find((u) => u.name.toLowerCase() === h) ||
    users.find((u) => u.name.toLowerCase().split(/\s+/).includes(h)) ||
    users.find((u) => u.name.toLowerCase().startsWith(h)) ||
    users.find((u) => u.name.toLowerCase().includes(h)) ||
    null
  );
}

export async function POST(req: Request) {
  // Проверка секрета вебхука, если задан (Telegram шлёт его заголовком).
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
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

  const text: string = message.text ?? "";
  if (!text) return NextResponse.json({ ok: true });

  // Кто пишет — только привязанный и не заблокированный сотрудник.
  const user = await prisma.user.findFirst({
    where: { telegramChatId: chatId, isBlocked: false },
    select: { id: true, name: true, role: true },
  });
  if (!user) {
    await sendMessage(
      chatId,
      "Ваш Telegram не привязан к аккаунту в CRM. Обратитесь к администратору, чтобы он привязал ваш профиль.",
    );
    return NextResponse.json({ ok: true });
  }

  const cmd = parseVoiceCommand(text);

  if (cmd.intent === "help") {
    await sendMessage(chatId, HELP);
    return NextResponse.json({ ok: true });
  }

  if (cmd.intent === "unknown") {
    await sendMessage(chatId, "Не понял команду. Начните со слова «задача» или «клиент».\n\n" + HELP);
    return NextResponse.json({ ok: true });
  }

  // ── Задача ─────────────────────────────────────────────────────────────────
  if (cmd.intent === "task") {
    if (!cmd.title) {
      await sendMessage(chatId, "Не понял, что за задача. Пример: «задача напечатать баннер для Васи к пятнице».");
      return NextResponse.json({ ok: true });
    }

    const users = await prisma.user.findMany({
      where: { isBlocked: false },
      select: { id: true, name: true },
    });
    let assignee: { id: string; name: string } | null = null;
    let assigneeMiss = false;
    if (cmd.assigneeHint) {
      assignee = matchUser(cmd.assigneeHint, users);
      assigneeMiss = !assignee;
    }

    const columns = await getTaskColumns();
    const firstColumn = columns.find((c) => c.isActive) ?? columns[0];

    const task = await prisma.task.create({
      data: {
        title: cmd.title,
        type: "DESIGN",
        priority: "NORMAL",
        status: firstColumn?.code ?? "TODO",
        assigneeId: assignee?.id,
        dueDate: cmd.dueDate ? new Date(cmd.dueDate) : undefined,
      },
    });

    let reply = `✅ Задача создана: <b>${esc(task.title)}</b>`;
    if (assignee) reply += `\n👤 Исполнитель: ${esc(assignee.name)}`;
    else if (assigneeMiss) reply += `\n⚠️ Сотрудник «${esc(cmd.assigneeHint!)}» не найден — задача без исполнителя`;
    if (task.dueDate) reply += `\n📅 Срок: ${task.dueDate.toLocaleDateString("ru-RU")}`;
    reply += `\n🔗 /tasks/${task.id}`;
    await sendMessage(chatId, reply);
    return NextResponse.json({ ok: true });
  }

  // ── Клиент ─────────────────────────────────────────────────────────────────
  if (cmd.intent === "client") {
    if (!["ADMIN", "MANAGER"].includes(user.role)) {
      await sendMessage(chatId, "Добавлять клиентов может администратор или менеджер.");
      return NextResponse.json({ ok: true });
    }
    if (!cmd.name) {
      await sendMessage(chatId, "Не понял имя клиента. Пример: «клиент Иван Петров, телефон +7 900 111-22-33».");
      return NextResponse.json({ ok: true });
    }

    // Тип по длине ИНН: 12 — ИП, 10 — юрлицо, иначе физлицо.
    const type = cmd.inn?.length === 12 ? "IP" : cmd.inn?.length === 10 ? "LEGAL" : "INDIVIDUAL";

    const client = await prisma.client.create({
      data: {
        type,
        name: cmd.name,
        phone: cmd.phone ?? undefined,
        inn: cmd.inn ?? undefined,
        email: cmd.email ?? undefined,
        source: "OTHER",
      },
    });

    let reply = `✅ Клиент добавлен: <b>${esc(client.name)}</b>`;
    if (client.phone) reply += `\n📞 ${esc(client.phone)}`;
    if (client.inn) reply += `\n🏢 ИНН ${esc(client.inn)}`;
    if (client.email) reply += `\n✉️ ${esc(client.email)}`;
    reply += `\n🔗 /clients/${client.id}`;
    await sendMessage(chatId, reply);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
