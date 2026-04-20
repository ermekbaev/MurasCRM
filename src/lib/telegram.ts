import { prisma } from "@/lib/prisma";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

const STATUS_LABELS: Record<string, string> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  READY: "Готово",
  ISSUED: "Выдано",
  CANCELLED: "Отменено",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Низкий",
  NORMAL: "Обычный",
  URGENT: "Срочный",
  VERY_URGENT: "Очень срочный",
};

export async function sendMessage(chatId: string, text: string): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch {
    // не прерываем основной поток при сбое отправки
  }
}

async function sendToUsers(userIds: string[], text: string): Promise<void> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, telegramChatId: { not: null }, isBlocked: false },
    select: { telegramChatId: true },
  });
  await Promise.all(users.map((u) => sendMessage(u.telegramChatId!, text)));
}

async function sendToRole(role: string, text: string): Promise<void> {
  const users = await prisma.user.findMany({
    where: { role: role as never, telegramChatId: { not: null }, isBlocked: false },
    select: { telegramChatId: true },
  });
  await Promise.all(users.map((u) => sendMessage(u.telegramChatId!, text)));
}

// Новая заявка → менеджер
export async function notifyNewOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: { select: { name: true } },
      manager: { select: { id: true, name: true } },
    },
  });
  if (!order || !order.manager) return;

  const text =
    `📋 <b>Новая заявка ${order.number}</b>\n` +
    `👤 Клиент: ${order.client.name}\n` +
    `⚡ Приоритет: ${PRIORITY_LABELS[order.priority]}\n` +
    (order.deadline ? `📅 Срок: ${new Date(order.deadline).toLocaleDateString("ru-RU")}\n` : "") +
    `🔗 /orders/${order.id}`;

  await sendToUsers([order.manager.id], text);
}

// Статус заявки изменился → исполнители + менеджер
export async function notifyOrderStatusChanged(
  orderId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: { select: { name: true } },
      manager: { select: { id: true } },
      assignees: { select: { id: true } },
    },
  });
  if (!order) return;

  const text =
    `🔄 <b>Статус заявки ${order.number} изменён</b>\n` +
    `👤 Клиент: ${order.client.name}\n` +
    `${STATUS_LABELS[oldStatus] ?? oldStatus} → <b>${STATUS_LABELS[newStatus] ?? newStatus}</b>`;

  const ids = [
    ...(order.manager ? [order.manager.id] : []),
    ...order.assignees.map((a) => a.id),
  ];
  await sendToUsers([...new Set(ids)], text);
}

// Задача назначена → исполнитель
export async function notifyTaskAssigned(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: { select: { id: true } },
      order: { select: { number: true } },
    },
  });
  if (!task || !task.assignee) return;

  const text =
    `📌 <b>Новая задача: ${task.title}</b>\n` +
    (task.order ? `📋 Заявка: ${task.order.number}\n` : "") +
    (task.dueDate ? `📅 Срок: ${new Date(task.dueDate).toLocaleDateString("ru-RU")}\n` : "") +
    `🔗 /tasks/${task.id}`;

  await sendToUsers([task.assignee.id], text);
}

// Файл на согласование → uploader получит от кого-то, но по ТЗ — адресат
// Здесь уведомляем всех, у кого есть доступ к согласованию (ADMIN + MANAGER)
export async function notifyFilePendingApproval(fileId: string): Promise<void> {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { uploadedBy: { select: { name: true } } },
  });
  if (!file) return;

  const text =
    `📎 <b>Файл отправлен на согласование</b>\n` +
    `📄 ${file.originalName}\n` +
    `👤 Загрузил: ${file.uploadedBy.name}\n` +
    `🔗 /files`;

  await Promise.all([sendToRole("ADMIN", text), sendToRole("MANAGER", text)]);
}

// Расходник ниже минимума → Admin
export async function notifyLowStock(consumableId: string): Promise<void> {
  const c = await prisma.consumable.findUnique({ where: { id: consumableId } });
  if (!c) return;

  const stock = Number(c.stock);
  const minStock = Number(c.minStock);
  if (stock >= minStock) return;

  const text =
    `⚠️ <b>Низкий остаток расходника</b>\n` +
    `📦 ${c.name}\n` +
    `Остаток: <b>${stock} ${c.unit}</b> (мин: ${minStock} ${c.unit})\n` +
    `🔗 /consumables`;

  await sendToRole("ADMIN", text);
}

// Счёт выставлен → бухгалтер
export async function notifyInvoiceCreated(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: { select: { name: true } } },
  });
  if (!invoice) return;

  const text =
    `💳 <b>Выставлен счёт ${invoice.number}</b>\n` +
    `👤 Клиент: ${invoice.client.name}\n` +
    `💰 Сумма: ${Number(invoice.total).toLocaleString("ru-RU")} сом\n` +
    `🔗 /invoices/${invoice.id}`;

  await sendToRole("ACCOUNTANT", text);
}
