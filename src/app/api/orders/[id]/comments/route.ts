import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Text required" }, { status: 400 });

  const comment = await prisma.orderComment.create({
    data: { orderId: id, userId: session.user.id, text: text.trim() },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json(comment, { status: 201 });
}
