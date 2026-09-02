import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { CHAT_ROLES } from "@/lib/chat-roles";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CHAT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const q = new URL(req.url).searchParams.get("q")?.trim();

  // Ищем по собеседнику, тексту переписки и именам файлов: менеджер обычно
  // помнит фразу из разговора или название присланного макета, а не имя в
  // телеграме.
  const where: Prisma.ConversationWhereInput = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { username: { contains: q, mode: "insensitive" } },
          { client: { name: { contains: q, mode: "insensitive" } } },
          { messages: { some: { text: { contains: q, mode: "insensitive" } } } },
          {
            messages: {
              some: { attachments: { some: { name: { contains: q, mode: "insensitive" } } } },
            },
          },
        ],
      }
    : {};

  const conversations = await prisma.conversation.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      client: { select: { id: true, name: true } },
      order: { select: { id: true, number: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { attachments: { select: { name: true, kind: true } } },
      },
    },
  });

  return NextResponse.json(
    conversations.map((c) => {
      const last = c.messages[0];
      const attachment = last?.attachments[0];
      return {
        ...c,
        // В списке показываем одну строку: текст, а если его нет — имя файла.
        lastMessage: last?.text || (attachment ? `📎 ${attachment.name}` : ""),
        lastDirection: last?.direction ?? null,
        messages: undefined,
      };
    }),
  );
}
