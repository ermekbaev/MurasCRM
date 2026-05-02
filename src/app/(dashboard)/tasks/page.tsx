import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import TasksClient from "./TasksClient";

export default async function TasksPage() {
  const session = await auth();
  const isRestricted = ["OPERATOR", "DESIGNER"].includes(session?.user.role || "");

  const where = isRestricted ? { assigneeId: session?.user.id } : {};

  const [tasks, users, orders] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        assignee: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            number: true,
            client: { select: { name: true } },
          },
        },
        checklistItems: { select: { id: true, isCompleted: true } },
      },
    }),
    prisma.user.findMany({
      where: { isBlocked: false },
      select: { id: true, name: true, role: true },
    }),
    prisma.order.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { id: true, number: true, client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <TasksClient
      initialTasks={tasks.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        dueDate: t.dueDate?.toISOString() || null,
        startedAt: t.startedAt?.toISOString() || null,
        finishedAt: t.finishedAt?.toISOString() || null,
      }))}
      users={users}
      orders={orders}
      currentUserId={session?.user.id || ""}
      currentRole={session?.user.role || "MANAGER"}
    />
  );
}
