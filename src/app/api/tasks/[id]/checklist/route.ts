import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId, isCompleted } = await req.json();
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  const item = await prisma.checklistItem.update({
    where: { id: itemId },
    data: { isCompleted },
  });

  return NextResponse.json(item);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Text required" }, { status: 400 });

  const count = await prisma.checklistItem.count({ where: { taskId: id } });
  const item = await prisma.checklistItem.create({
    data: { taskId: id, text: text.trim(), sortOrder: count },
  });

  return NextResponse.json(item, { status: 201 });
}
