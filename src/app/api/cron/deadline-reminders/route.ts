import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/telegram";

export async function GET(req: Request) {
  // Vercel Cron передаёт: Authorization: Bearer <CRON_SECRET>
  // Ручной вызов допускает: ?secret=<CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get("secret");

  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : querySecret;
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      deadline: { gte: in24h, lte: in25h },
      status: { notIn: ["READY", "ISSUED", "CANCELLED"] },
    },
    include: {
      client: { select: { name: true } },
      manager: { select: { id: true, telegramChatId: true } },
      assignees: { select: { id: true, telegramChatId: true } },
    },
  });

  let sent = 0;

  for (const order of orders) {
    const deadline = order.deadline!.toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Europe/Moscow",
    });

    const text =
      `⏰ <b>Срок сдачи заявки через 1 день!</b>\n` +
      `📋 Заявка: <b>${order.number}</b>\n` +
      `👤 Клиент: ${order.client.name}\n` +
      `📅 Дедлайн: ${deadline}`;

    const recipients = [order.manager, ...order.assignees]
      .filter(Boolean)
      .filter((u) => u?.telegramChatId);

    for (const user of recipients) {
      if (user?.telegramChatId) {
        await sendMessage(user.telegramChatId, text);
        sent++;
      }
    }
  }

  return NextResponse.json({ ok: true, checked: orders.length, sent });
}
