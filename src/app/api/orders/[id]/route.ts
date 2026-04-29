import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { notifyOrderStatusChanged } from "@/lib/telegram";

const updateSchema = z.object({
  status: z.enum(["NEW", "IN_PROGRESS", "REVIEW", "READY", "ISSUED", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "URGENT", "VERY_URGENT"]).optional(),
  deadline: z.string().nullable().optional(),
  paymentStatus: z.enum(["UNPAID", "ADVANCE", "PAID"]).optional(),
  notes: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  managerId: z.string().optional(),
});

async function deductConsumablesForOrder(orderId: string, newStatus: string) {
  const trigger = newStatus === "IN_PROGRESS" ? "ON_IN_PROGRESS" : newStatus === "READY" ? "ON_READY" : undefined;
  if (!trigger) return;

  const items = await prisma.orderItem.findMany({
    where: { orderId, equipmentId: { not: null } },
    include: {
      equipment: {
        include: {
          equipmentConsumables: {
            where: { autoDeduct: true, trigger },
          },
        },
      },
    },
  });

  const itemIds = items.map((i) => i.id);
  if (!itemIds.length) return;

  // Batch-check already deducted: one query instead of N×M
  const existing = await prisma.consumableMovement.findMany({
    where: { orderItemId: { in: itemIds } },
    select: { orderItemId: true, consumableId: true },
  });
  const deducted = new Set(existing.map((m) => `${m.orderItemId}:${m.consumableId}`));

  for (const item of items) {
    if (!item.equipment) continue;
    const configs = item.equipment.equipmentConsumables;
    if (!configs.length) continue;

    for (const cfg of configs) {
      if (deducted.has(`${item.id}:${cfg.consumableId}`)) continue;

      const waste = item.includeWaste && item.equipment.wastePerJob ? Number(item.equipment.wastePerJob) : 0;
      const qty = Number(item.qty) * Number(cfg.consumptionPerUnit) + waste;
      if (qty <= 0) continue;

      await prisma.$transaction([
        prisma.consumableMovement.create({
          data: {
            consumableId: cfg.consumableId,
            direction: "OUT",
            qty,
            orderId,
            orderItemId: item.id,
            note: `Авто-списание по заказу, позиция: ${item.name}`,
          },
        }),
        prisma.consumable.update({
          where: { id: cfg.consumableId },
          data: { stock: { decrement: qty } },
        }),
      ]);
    }
  }
}

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, ...orderAccessFilter(session.user.id, session.user.role) },
    include: {
      client: true,
      manager: { select: { id: true, name: true, email: true } },
      assignees: { select: { id: true, name: true, role: true } },
      items: { include: { equipment: true } },
      files: { include: { file: true } },
      comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      changeLogs: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      tasks: {
        include: { assignee: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { assigneeIds, deadline, ...rest } = parsed.data;

  // Log status changes + notify
  if (rest.status && rest.status !== existing.status) {
    await prisma.changeLog.create({
      data: {
        orderId: id,
        field: "status",
        oldValue: existing.status,
        newValue: rest.status,
        userId: session.user.id,
      },
    });
    notifyOrderStatusChanged(id, existing.status, rest.status).catch(console.error);

    // Авто-списание расходников при переходе в нужный статус
    await deductConsumablesForOrder(id, rest.status);
  }

  const order = await prisma.order.update({
    where: { id },
    data: {
      ...rest,
      deadline: deadline === null ? null : deadline ? new Date(deadline) : undefined,
      assignees: assigneeIds
        ? { set: assigneeIds.map((aid) => ({ id: aid })) }
        : undefined,
    },
    include: {
      client: { select: { name: true } },
      assignees: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(order);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  await prisma.order.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
