import { NextResponse } from "next/server";
import { auth } from "@/auth";
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      manager: { select: { id: true, name: true, email: true } },
      assignees: { select: { id: true, name: true, role: true } },
      items: { include: { service: true } },
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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    notifyOrderStatusChanged(id, existing.status, rest.status);

    // Auto write-off consumables when order is issued
    if (rest.status === "ISSUED") {
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: id, serviceId: { not: null } },
        select: { serviceId: true, qty: true },
      });
      const serviceIds = orderItems.map((i) => i.serviceId!).filter(Boolean);
      if (serviceIds.length > 0) {
        const serviceConsumables = await prisma.serviceConsumable.findMany({
          where: { serviceId: { in: serviceIds } },
        });
        for (const item of orderItems) {
          if (!item.serviceId) continue;
          const linked = serviceConsumables.filter((sc) => sc.serviceId === item.serviceId);
          for (const sc of linked) {
            const qty = Number(item.qty) * Number(sc.qtyPerUnit);
            await prisma.$transaction([
              prisma.consumableMovement.create({
                data: {
                  consumableId: sc.consumableId,
                  direction: "OUT",
                  qty,
                  orderId: id,
                  note: `Авто-списание по заявке`,
                  totalCost: null,
                },
              }),
              prisma.consumable.update({
                where: { id: sc.consumableId },
                data: { stock: { decrement: qty } },
              }),
            ]);
          }
        }
      }
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

  return NextResponse.json(order);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  await prisma.order.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
