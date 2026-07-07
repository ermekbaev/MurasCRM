import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  label: z.string().min(1).max(64).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const type = await prisma.orderTypeOption.update({ where: { id }, data: parsed.data });
  return NextResponse.json(type);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const type = await prisma.orderTypeOption.findUnique({ where: { id } });
  if (!type) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Нельзя удалить тип, если он уже используется в заявках
  const used = await prisma.order.count({ where: { type: type.code } });
  if (used > 0) {
    return NextResponse.json(
      { error: `Тип используется в ${used} заявк(ах). Отключите его вместо удаления.` },
      { status: 409 }
    );
  }

  await prisma.orderTypeOption.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
