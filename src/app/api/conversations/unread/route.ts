import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { CHAT_ROLES } from "@/lib/chat-roles";

/** Счётчик для значка в меню — намеренно лёгкий, его дёргают с каждой страницы. */
export async function GET() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CHAT_ROLES.includes(session.user.role)) return NextResponse.json({ unread: 0 });

  const { _sum } = await prisma.conversation.aggregate({ _sum: { unread: true } });
  return NextResponse.json({ unread: _sum.unread ?? 0 });
}
