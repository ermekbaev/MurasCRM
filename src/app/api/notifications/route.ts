import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendMessage } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  userId: z.string().optional(),
  role: z.string().optional(),
  text: z.string().min(1),
});

// Ручная отправка уведомления (только Admin)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { userId, role, text } = parsed.data;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true },
    });
    if (!user?.telegramChatId) {
      return NextResponse.json({ error: "У пользователя нет Telegram Chat ID" }, { status: 400 });
    }
    await sendMessage(user.telegramChatId, text);
  } else if (role) {
    const users = await prisma.user.findMany({
      where: { role: role as never, telegramChatId: { not: null }, isBlocked: false },
      select: { telegramChatId: true },
    });
    await Promise.all(users.map((u) => sendMessage(u.telegramChatId!, text)));
  } else {
    return NextResponse.json({ error: "Укажите userId или role" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// Получить список пользователей с/без Telegram (для настроек)
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { isBlocked: false },
    select: { id: true, name: true, role: true, telegramChatId: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    users.map((u) => ({ ...u, hasTelegram: !!u.telegramChatId }))
  );
}
