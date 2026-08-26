import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  label: z.string().min(1).max(64).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  const source = await prisma.clientSourceOption.update({ where: { id }, data: parsed.data });
  return NextResponse.json(source);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  const { id } = await params;
  const source = await prisma.clientSourceOption.findUnique({ where: { id } });
  if (!source) return apiError.notFound();

  // Источник, уже проставленный клиентам, удалять нельзя — иначе в карточках
  // останется код без названия.
  const used = await prisma.client.count({ where: { source: source.code } });
  if (used > 0) {
    return NextResponse.json(
      { error: `Источник указан у ${used} клиент(ов). Отключите его вместо удаления.` },
      { status: 409 },
    );
  }

  await prisma.clientSourceOption.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
