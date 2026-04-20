import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateUploadUrl } from "@/lib/s3";
import { z } from "zod";
import { randomUUID } from "crypto";

const attachSchema = z.object({
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  category: z.enum(["SOURCES", "PENDING_APPROVAL", "APPROVED", "READY", "ARCHIVE"]).default("SOURCES"),
  comment: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const taskFiles = await prisma.taskFile.findMany({
    where: { taskId: id },
    include: {
      file: {
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(taskFiles);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = attachSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { originalName, mimeType, size, category, comment } = parsed.data;

  const ext = originalName.split(".").pop() || "bin";
  const key = `tasks/${id}/${randomUUID()}.${ext}`;

  const uploadUrl = await generateUploadUrl(key, mimeType).catch(() => null);

  const file = await prisma.file.create({
    data: {
      key,
      originalName,
      size,
      mimeType,
      category,
      uploadedById: session.user.id,
      linkedTo: "task",
      linkedId: id,
      comment,
    },
  });

  const taskFile = await prisma.taskFile.create({
    data: { taskId: id, fileId: file.id },
    include: { file: { include: { uploadedBy: { select: { id: true, name: true } } } } },
  });

  return NextResponse.json({ taskFile, uploadUrl }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const taskFileId = searchParams.get("taskFileId");
  if (!taskFileId) return NextResponse.json({ error: "taskFileId required" }, { status: 400 });

  const taskFile = await prisma.taskFile.findFirst({ where: { id: taskFileId, taskId: id } });
  if (!taskFile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.taskFile.delete({ where: { id: taskFileId } });
  return NextResponse.json({ ok: true });
}
