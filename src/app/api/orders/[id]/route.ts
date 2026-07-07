import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { notifyOrderStatusChanged, notifyLowStock } from "@/lib/telegram";

const updateSchema = z.object({
  status: z.enum(["NEW", "IN_PROGRESS", "REVIEW", "READY", "ISSUED", "CANCELLED"]).optional(),
  title: z.string().max(200).nullable().optional(),
  type: z.string().min(1).optional(),
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
            include: { consumable: { select: { writeoffPrice: true, purchasePrice: true } } },
          },
        },
      },
    },
  });

  if (!items.length) return;

  // Дедуп на уровне (заказ + расходник + триггер): устойчив к правке позиций,
  // т.к. при PUT позиции пересоздаются с новыми id (orderItemId обнуляется).
  const existing = await prisma.consumableMovement.findMany({
    where: { orderId, trigger },
    select: { consumableId: true },
  });
  const deducted = new Set(existing.map((m) => m.consumableId));
  const affected = new Set<string>();

  for (const item of items) {
    if (!item.equipment) continue;
    const configs = item.equipment.equipmentConsumables;
    if (!configs.length) continue;

    for (const cfg of configs) {
      if (deducted.has(cfg.consumableId)) continue;

      const qty = Number(item.qty) * Number(cfg.consumptionPerUnit);
      if (qty <= 0) continue;

      const unitPrice = Number(cfg.consumable.writeoffPrice) || Number(cfg.consumable.purchasePrice) || 0;
      const totalCost = unitPrice > 0 ? qty * unitPrice : null;

      await prisma.$transaction([
        prisma.consumableMovement.create({
          data: {
            consumableId: cfg.consumableId,
            direction: "OUT",
            qty,
            orderId,
            orderItemId: item.id,
            trigger,
            note: `Авто-списание по заказу, позиция: ${item.name}`,
            totalCost,
          },
        }),
        prisma.consumable.update({
          where: { id: cfg.consumableId },
          data: { stock: { decrement: qty } },
        }),
      ]);
      affected.add(cfg.consumableId);
    }
  }

  // Уведомить админов, если остаток упал ниже минимума (по каждому списанному расходнику один раз)
  for (const consumableId of affected) {
    await notifyLowStock(consumableId).catch(console.error);
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

// Поля, которые могут менять разные роли
const FULL_EDIT_ROLES = ["ADMIN", "MANAGER"];
const PAYMENT_EDIT_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT"];
// status может менять любой с доступом к заказу (assignee / manager / privileged)

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.order.findFirst({
    where: { id, ...orderAccessFilter(session.user.id, session.user.role) },
    include: { assignees: { select: { id: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { assigneeIds, deadline, ...rest } = parsed.data;
  const { role, id: userId } = session.user;
  const isFullEditor = FULL_EDIT_ROLES.includes(role);

  // RBAC по полям
  if (!isFullEditor) {
    // Поля, которые НЕ может менять не-админ/не-менеджер
    const forbiddenFields: string[] = [];
    if (rest.title !== undefined) forbiddenFields.push("title");
    if (rest.type !== undefined) forbiddenFields.push("type");
    if (rest.priority !== undefined) forbiddenFields.push("priority");
    if (deadline !== undefined) forbiddenFields.push("deadline");
    if (rest.notes !== undefined) forbiddenFields.push("notes");
    if (rest.managerId !== undefined) forbiddenFields.push("managerId");
    if (assigneeIds !== undefined) forbiddenFields.push("assigneeIds");
    if (rest.paymentStatus !== undefined && !PAYMENT_EDIT_ROLES.includes(role)) {
      forbiddenFields.push("paymentStatus");
    }
    if (forbiddenFields.length) {
      return NextResponse.json(
        { error: `Недостаточно прав для изменения: ${forbiddenFields.join(", ")}` },
        { status: 403 }
      );
    }
    // Не-админ/менеджер может менять статус только если он assignee
    if (rest.status !== undefined) {
      const isAssignee = existing.assignees.some((a) => a.id === userId);
      if (!isAssignee) {
        return NextResponse.json({ error: "Только исполнители могут менять статус" }, { status: 403 });
      }
    }
  }

  if (rest.type !== undefined) {
    const typeExists = await prisma.orderTypeOption.findUnique({ where: { code: rest.type } });
    if (!typeExists) {
      return NextResponse.json({ error: "Неизвестный тип заявки" }, { status: 400 });
    }
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

  // Log status changes + notify (после успешного update — иначе расходники списались бы при ошибке)
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
    await deductConsumablesForOrder(id, rest.status).catch(console.error);
  }

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
