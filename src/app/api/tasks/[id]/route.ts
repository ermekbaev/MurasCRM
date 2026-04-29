import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { notifyTaskAssigned } from "@/lib/telegram";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "URGENT", "VERY_URGENT"]).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  type: z.enum(["DESIGN", "FILE_PREP", "PRINT", "CUT", "LAMINATION", "MOUNTING", "QC"]).optional(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true } },
      order: { select: { id: true, number: true, client: { select: { name: true } } } },
      checklistItems: { orderBy: { sortOrder: "asc" } },
      comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { dueDate, startedAt, finishedAt, ...rest } = parsed.data;

  const existing = await prisma.task.findUnique({ where: { id }, select: { assigneeId: true, startedAt: true } });

  // Auto-set startedAt when status changes to IN_PROGRESS
  const extraData: Record<string, unknown> = {};
  if (rest.status === "IN_PROGRESS" && !existing?.startedAt) {
    extraData.startedAt = new Date();
  }
  if (rest.status === "DONE") {
    extraData.finishedAt = new Date();
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...rest,
      ...extraData,
      dueDate: dueDate === null ? null : dueDate ? new Date(dueDate) : undefined,
    },
    include: {
      assignee: { select: { id: true, name: true } },
    },
  });

  // Notify new assignee if assigneeId changed
  if (rest.assigneeId && rest.assigneeId !== existing?.assigneeId) {
    notifyTaskAssigned(task.id).catch(() => {});
  }

  return NextResponse.json(task);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
