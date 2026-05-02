import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { notifyFilePendingApproval } from "@/lib/telegram";

const patchSchema = z.object({
  status: z.enum(["UPLOADED", "PENDING_APPROVAL", "APPROVED", "REVISION"]).optional(),
  category: z.enum(["SOURCES", "PENDING_APPROVAL", "APPROVED", "READY", "ARCHIVE"]).optional(),
  comment: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.file.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPrivileged = ["ADMIN", "MANAGER"].includes(session.user.role);
  if (!isPrivileged && existing.uploadedById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const file = await prisma.file.update({
    where: { id },
    data: parsed.data,
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  if (parsed.data.status === "PENDING_APPROVAL" && existing.status !== "PENDING_APPROVAL") {
    notifyFilePendingApproval(file.id).catch(() => {});
  }

  return NextResponse.json(file);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (
    session.user.role !== "ADMIN" &&
    file.uploadedById !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.file.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
