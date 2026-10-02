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
  | { kind: "say"; text: string }
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

/** Русское склонение по числу: [1, 2-4, 5+]. */
function plural(n: number, forms: [string, string, string]): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

function listTitles(titles: string[], max = 5): string {
  const shown = titles.slice(0, max).join(", ");
  const rest = titles.length - max;
  return rest > 0 ? `${shown} и ещё ${rest}` : shown;
}

async function runQuery(
  query: "my_tasks" | "today_tasks" | "orders_in_progress",
  user: VoiceUser,
): Promise<string> {
  if (query === "orders_in_progress") {
    const n = await prisma.order.count({ where: { status: "IN_PROGRESS" } });
    if (n === 0) return "В работе нет заказов.";
    return `В работе ${n} ${plural(n, ["заказ", "заказа", "заказов"])}.`;
  }

  const isPrivileged = ["ADMIN", "MANAGER"].includes(user.role);

  if (query === "today_tasks") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const where: Record<string, unknown> = { dueDate: { gte: start, lt: end } };
    if (!isPrivileged) where.assigneeId = user.id;
    const tasks = await prisma.task.findMany({ where, select: { title: true }, orderBy: { dueDate: "asc" }, take: 20 });
    if (tasks.length === 0) return "На сегодня задач нет.";
    return `На сегодня ${tasks.length} ${plural(tasks.length, ["задача", "задачи", "задач"])}: ${listTitles(tasks.map((t) => t.title))}.`;
  }

  // my_tasks
  const tasks = await prisma.task.findMany({
    where: { assigneeId: user.id },
    select: { title: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (tasks.length === 0) return "У вас нет задач.";
  return `У вас ${tasks.length} ${plural(tasks.length, ["задача", "задачи", "задач"])}: ${listTitles(tasks.map((t) => t.title))}.`;
}

export async function executeVoiceCommand(text: string, user: VoiceUser): Promise<VoiceResult> {
  const cmd = parseVoiceCommand(text);

  if (cmd.intent === "help") return { kind: "help" };
  if (cmd.intent === "unknown") return { kind: "unknown" };

  if (cmd.intent === "query") {
    const settings = await prisma.companySettings.findFirst({ select: { voiceQueriesEnabled: true } });
    if (settings && settings.voiceQueriesEnabled === false) {
      return { kind: "need", message: "Голосовые запросы выключены в настройках." };
    }
    return { kind: "say", text: await runQuery(cmd.query, user) };
  }

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
  "• Клиент: «клиент Иван Петров, телефон +7 900 111-22-33, инн 7701234567»\n" +
  "• Отчёты: «мои задачи», «задачи на сегодня», «сколько заказов в работе»\n\n" +
  "Срок можно словами: сегодня, завтра, к пятнице, через 3 дня, 5 октября, до 05.10.";
