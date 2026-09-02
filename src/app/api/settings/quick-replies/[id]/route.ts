import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { CHAT_LINK_ROLES } from "@/lib/chat-roles";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(1).max(64).optional(),
  text: z.string().min(1).max(4000).optional(),
  sortOrder: z.number().int().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CHAT_LINK_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  const reply = await prisma.quickReply.update({ where: { id }, data: parsed.data });
  return NextResponse.json(reply);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CHAT_LINK_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  await prisma.quickReply.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
