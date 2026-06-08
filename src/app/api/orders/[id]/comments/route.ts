import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

function orderAccessFilter(userId: string, role: string) {
  if (["ADMIN", "MANAGER", "ACCOUNTANT"].includes(role)) return {};
  if (role === "OPERATOR") return { assignees: { some: { id: userId } } };
  if (role === "DESIGNER") return {
    OR: [
      { assignees: { some: { id: userId } } },
      { tasks: { some: { assigneeId: userId } } },
    ],
  };
  return { assignees: { some: { id: userId } } };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Проверяем что у пользователя есть доступ к заказу
  const accessible = await prisma.order.findFirst({
    where: { id, ...orderAccessFilter(session.user.id, session.user.role) },
    select: { id: true },
  });
  if (!accessible) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Text required" }, { status: 400 });

  const comment = await prisma.orderComment.create({
    data: { orderId: id, userId: session.user.id, text: text.trim() },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json(comment, { status: 201 });
}
