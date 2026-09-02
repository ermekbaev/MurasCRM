import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { CHAT_ROLES, CHAT_LINK_ROLES } from "@/lib/chat-roles";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(1).max(64),
  text: z.string().min(1).max(4000),
});

/** Читать заготовки может каждый, кто ведёт переписку. */
export async function GET() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CHAT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const replies = await prisma.quickReply.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(replies);
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!CHAT_LINK_ROLES.includes(session.user.role)) return apiError.forbidden();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  const max = await prisma.quickReply.aggregate({ _max: { sortOrder: true } });
  const reply = await prisma.quickReply.create({
    data: { ...parsed.data, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(reply, { status: 201 });
}
