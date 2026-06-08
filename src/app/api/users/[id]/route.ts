import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  isBlocked: z.boolean().optional(),
  role: z.enum(["ADMIN", "MANAGER", "DESIGNER", "OPERATOR", "ACCOUNTANT"]).optional(),
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  telegramChatId: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { isBlocked, role, name, phone, telegramChatId } = parsed.data;

  // Защита от admin lockout: нельзя себе понизить роль или заблокировать себя
  if (id === session.user.id) {
    if (role !== undefined && role !== "ADMIN") {
      return NextResponse.json({ error: "Нельзя понизить собственную роль" }, { status: 400 });
    }
    if (isBlocked === true) {
      return NextResponse.json({ error: "Нельзя заблокировать самого себя" }, { status: 400 });
    }
  }

  // Защита от потери последнего админа
  if ((role !== undefined && role !== "ADMIN") || isBlocked === true) {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (target?.role === "ADMIN") {
      const activeAdmins = await prisma.user.count({
        where: { role: "ADMIN", isBlocked: false },
      });
      if (activeAdmins <= 1) {
        return NextResponse.json({ error: "Нельзя удалить/заблокировать последнего администратора" }, { status: 400 });
      }
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(isBlocked !== undefined ? { isBlocked } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(telegramChatId !== undefined ? { telegramChatId } : {}),
    },
    select: { id: true, email: true, name: true, role: true, isBlocked: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  if (id === session.user.id) return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });

  // Защита от потери последнего админа
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (target?.role === "ADMIN") {
    const activeAdmins = await prisma.user.count({
      where: { role: "ADMIN", isBlocked: false },
    });
    if (activeAdmins <= 1) {
      return NextResponse.json({ error: "Нельзя удалить последнего администратора" }, { status: 400 });
    }
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
