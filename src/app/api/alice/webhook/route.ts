import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeVoiceCommand } from "@/lib/voice-run.server";

export const dynamic = "force-dynamic";

/**
 * Навык Яндекс.Диалогов (Алиса): голосовые команды «задача …», «клиент …».
 *
 * Яндекс сам распознаёт речь и присылает текст — ИИ на нашей стороне не нужен.
 * Заголовки Яндекс не шлёт, поэтому секрет передаётся в URL (?key=…) и
 * сверяется с настройками. Автор опознаётся по стабильному user_id Яндекса
 * после привязки кодом (тем же, что и для Telegram).
 */

type AliceReq = {
  version?: string;
  session?: {
    new?: boolean;
    user?: { user_id?: string };
    application?: { application_id?: string };
  };
  request?: { original_utterance?: string; command?: string };
};

function reply(text: string, version: string, endSession = false) {
  return NextResponse.json({
    response: { text, tts: text, end_session: endSession },
    version,
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => null)) as AliceReq | null;
  const version = body?.version || "1.0";

  // Секрет навыка из настроек — в URL, т.к. Яндекс не шлёт заголовки.
  const settings = await prisma.companySettings.findFirst({ select: { aliceSecret: true } });
  if (!settings?.aliceSecret) {
    return reply("Навык не подключён. Обратитесь к администратору.", version, true);
  }
  if (url.searchParams.get("key") !== settings.aliceSecret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const aliceId = body?.session?.user?.user_id || body?.session?.application?.application_id || null;
  const utterance = (body?.request?.original_utterance || body?.request?.command || "").trim();

  // Первый запуск/пустая фраза — короткое приветствие.
  if (body?.session?.new && !utterance) {
    return reply(
      "Готова принять команду. Скажите: задача, и что сделать, для кого и срок. Или: клиент, и данные.",
      version,
    );
  }

  // Привязка по коду — до опознания автора.
  const link = utterance.match(/(?:привяжи|привязать|код)(?:\s+код)?\s+(\S+)/i);
  if (link) {
    const code = link[1].replace(/[^\wА-Яа-яЁё]/g, "");
    const target = await prisma.user.findFirst({ where: { linkCode: code, isBlocked: false } });
    if (!target) return reply("Код не найден или устарел. Попросите новый у администратора.", version);
    await prisma.user.update({ where: { id: target.id }, data: { aliceUserId: aliceId ?? undefined, linkCode: null } });
    return reply(`Готово, ${target.name}. Аккаунт привязан. Скажите: задача или клиент.`, version);
  }

  if (!aliceId) return reply("Не удалось определить пользователя. Попробуйте ещё раз.", version);

  const user = await prisma.user.findFirst({
    where: { aliceUserId: aliceId, isBlocked: false },
    select: { id: true, name: true, role: true },
  });
  if (!user) {
    return reply(
      "Ваш аккаунт не привязан к CRM. Возьмите код у администратора и скажите: привяжи, и код.",
      version,
    );
  }

  const result = await executeVoiceCommand(utterance, user);

  switch (result.kind) {
    case "help":
      return reply("Скажите: задача, и что сделать, для кого и срок. Или: клиент, и имя с телефоном.", version);
    case "unknown":
      return reply("Не поняла. Начните со слова задача или клиент.", version);
    case "need":
      return reply(result.message, version);
    case "task": {
      let t = `Задача создана: ${result.title}.`;
      if (result.assigneeName) t += ` Исполнитель ${result.assigneeName}.`;
      else if (result.assigneeMiss) t += ` Сотрудник ${result.assigneeMiss} не найден, задача без исполнителя.`;
      if (result.dueDate) t += ` Срок ${result.dueDate.toLocaleDateString("ru-RU")}.`;
      return reply(t, version);
    }
    case "client": {
      let t = `Клиент добавлен: ${result.name}.`;
      if (result.phone) t += ` Телефон ${result.phone}.`;
      return reply(t, version);
    }
  }
}
