import { prisma } from "@/lib/prisma";
import { getTaskColumns } from "@/lib/taskColumns.server";
import { parseVoiceCommand } from "@/lib/voice-command";

/**
 * Исполнение разобранной голосовой команды: создаёт задачу или клиента и
 * возвращает структурный результат. Форматирование ответа — на стороне канала
 * (Telegram — с HTML и ссылками, Алиса — простым текстом голосом).
 */

export type VoiceUser = { id: string; name: string; role: string };

export type VoiceResult =
  | { kind: "help" }
  | { kind: "unknown" }
  | { kind: "need"; message: string }
  | {
      kind: "task";
      id: string;
      title: string;
      assigneeName: string | null;
      assigneeMiss: string | null;
      dueDate: Date | null;
    }
  | {
      kind: "client";
      id: string;
      name: string;
      phone: string | null;
      inn: string | null;
      email: string | null;
    };

/** Сопоставляет подсказку-имя с активным сотрудником (регистронезависимо). */
function matchUser(hint: string, users: { id: string; name: string }[]) {
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

export async function executeVoiceCommand(text: string, user: VoiceUser): Promise<VoiceResult> {
  const cmd = parseVoiceCommand(text);

  if (cmd.intent === "help") return { kind: "help" };
  if (cmd.intent === "unknown") return { kind: "unknown" };

  if (cmd.intent === "task") {
    if (!cmd.title) {
      return { kind: "need", message: "Не понял, что за задача. Пример: «задача напечатать баннер для Васи к пятнице»." };
    }
    const users = await prisma.user.findMany({ where: { isBlocked: false }, select: { id: true, name: true } });
    let assignee: { id: string; name: string } | null = null;
    let assigneeMiss: string | null = null;
    if (cmd.assigneeHint) {
      assignee = matchUser(cmd.assigneeHint, users);
      if (!assignee) assigneeMiss = cmd.assigneeHint;
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

    return {
      kind: "task",
      id: task.id,
      title: task.title,
      assigneeName: assignee?.name ?? null,
      assigneeMiss,
      dueDate: task.dueDate ?? null,
    };
  }

  // client
  if (!["ADMIN", "MANAGER"].includes(user.role)) {
    return { kind: "need", message: "Добавлять клиентов может администратор или менеджер." };
  }
  if (!cmd.name) {
    return { kind: "need", message: "Не понял имя клиента. Пример: «клиент Иван Петров, телефон +7 900 111-22-33»." };
  }
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
  return {
    kind: "client",
    id: client.id,
    name: client.name,
    phone: client.phone,
    inn: client.inn,
    email: client.email,
  };
}

export const VOICE_HELP =
  "Что умею:\n" +
  "• Задача: «задача напечатать баннер для Васи к пятнице»\n" +
  "• Клиент: «клиент Иван Петров, телефон +7 900 111-22-33, инн 7701234567»\n\n" +
  "Срок можно словами: сегодня, завтра, к пятнице, через 3 дня, 5 октября, до 05.10.";
