import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const { isBlocked, role, name, phone, telegramChatId } = await req.json();

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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  if (id === session.user.id) return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
