import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { randomInt } from "crypto";

// Без похожих символов (0/O, 1/I), чтобы код легко продиктовать.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    let code = "";
    for (let j = 0; j < 6; j++) code += ALPHABET[randomInt(ALPHABET.length)];
    const exists = await prisma.user.findUnique({ where: { linkCode: code } });
    if (!exists) return code;
  }
  throw new Error("cannot generate unique link code");
}

/** Выдать сотруднику код привязки Telegram/Алисы. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();
  const { id } = await params;

  const code = await uniqueCode();
  await prisma.user.update({ where: { id }, data: { linkCode: code } });
  return NextResponse.json({ code });
}

/** Отвязать Telegram/Алису у сотрудника. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();
  const { id } = await params;

  await prisma.user.update({
    where: { id },
    data: { telegramChatId: null, aliceUserId: null, linkCode: null },
  });
  return NextResponse.json({ ok: true });
}
