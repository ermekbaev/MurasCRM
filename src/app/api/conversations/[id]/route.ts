import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CHAT_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT", "DESIGNER"];

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
      messages: { orderBy: { createdAt: "asc" }, take: 300 },
    },
  });
  if (!conversation) return apiError.notFound();

  if (conversation.unread > 0) {
    await prisma.conversation.update({ where: { id }, data: { unread: 0 } });
  }

  return NextResponse.json({ ...conversation, unread: 0 });
}

/** Привязка диалога к клиенту или заявке. */
export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return apiError.forbidden();

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
