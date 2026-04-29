import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { notifyTaskAssigned } from "@/lib/telegram";

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  orderId: z.string().optional(),
  assigneeId: z.string().optional(),
  type: z.enum(["DESIGN", "FILE_PREP", "PRINT", "CUT", "LAMINATION", "MOUNTING", "QC"]).default("DESIGN"),
  priority: z.enum(["LOW", "NORMAL", "URGENT", "VERY_URGENT"]).default("NORMAL"),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
  checklistItems: z.array(z.object({ text: z.string() })).optional(),
});

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const type = searchParams.get("type") || "";
  const orderId = searchParams.get("orderId") || "";

  const where: Record<string, unknown> = {};

  if (["OPERATOR", "DESIGNER"].includes(session.user.role)) {
    where.assigneeId = session.user.id;
  }

  if (status) where.status = status;
  if (type) where.type = type;
  if (orderId) where.orderId = orderId;

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      assignee: { select: { id: true, name: true } },
      order: { select: { id: true, number: true, client: { select: { name: true } } } },
      _count: { select: { checklistItems: true, comments: true } },
      checklistItems: { select: { id: true, isCompleted: true } },
    },
  });

  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = taskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { checklistItems = [], dueDate, ...rest } = parsed.data;

  const task = await prisma.task.create({
    data: {
      ...rest,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      checklistItems: checklistItems.length
        ? { create: checklistItems.map((c, i) => ({ text: c.text, sortOrder: i })) }
        : undefined,
    },
    include: {
      assignee: { select: { id: true, name: true } },
      order: { select: { id: true, number: true } },
      checklistItems: true,
    },
  });

  if (task.assignee) notifyTaskAssigned(task.id);

  return NextResponse.json(task, { status: 201 });
}
