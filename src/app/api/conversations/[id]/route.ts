import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { CHAT_ROLES, CHAT_LINK_ROLES } from "@/lib/chat-roles";
import { whatsappWindow } from "@/lib/chat-window";
import { z } from "zod";

const patchSchema = z.object({
  clientId: z.string().nullable().optional(),
  orderId: z.string().nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

/** Переписка целиком. Открытие диалога снимает счётчик непрочитанных. */
export async function GET(_req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CHAT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      order: { select: { id: true, number: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 300,
        include: {
          attachments: {
            select: {
              id: true,
              kind: true,
              name: true,
              mimeType: true,
              size: true,
              key: true,
              failReason: true,
            },
          },
        },
      },
    },
  });
  if (!conversation) return apiError.notFound();

  if (conversation.unread > 0) {
    await prisma.conversation.update({ where: { id }, data: { unread: 0 } });
  }

  // Для WhatsApp отдаём состояние окна: страница должна объяснить запрет
  // заранее, а не показывать отказ Meta после набранного ответа.
  const lastInbound = [...conversation.messages]
    .reverse()
    .find((m) => m.direction === "IN");
  const window =
    conversation.channel === "WHATSAPP"
      ? whatsappWindow(lastInbound?.createdAt ?? null)
      : { open: true, expiresAt: null };

  return NextResponse.json({
    ...conversation,
    window,
    unread: 0,
    messages: conversation.messages.map((m) => ({
      ...m,
      attachments: m.attachments.map((a) => ({
        ...a,
        // Ключ хранилища наружу не отдаём: файл забирают по нашей ссылке.
        key: undefined,
        available: Boolean(a.key),
      })),
    })),
  });
}

/** Привязка диалога к клиенту или заявке. */
export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CHAT_LINK_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  const conversation = await prisma.conversation.update({
    where: { id },
    data: parsed.data,
    include: {
      client: { select: { id: true, name: true } },
      order: { select: { id: true, number: true } },
    },
  });
  return NextResponse.json(conversation);
}
