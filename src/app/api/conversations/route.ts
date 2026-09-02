import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const CHAT_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT", "DESIGNER"];

export async function GET() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CHAT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const conversations = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      client: { select: { id: true, name: true } },
      order: { select: { id: true, number: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return NextResponse.json(
    conversations.map((c) => ({
      ...c,
      lastMessage: c.messages[0]?.text ?? "",
      messages: undefined,
    })),
  );
}
