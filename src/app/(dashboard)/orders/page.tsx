import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import OrdersClient from "./OrdersClient";

export default async function OrdersPage() {
  const session = await auth();

  const where: Record<string, unknown> = {};
  if (session?.user.role === "OPERATOR") {
    where.assignees = { some: { id: session.user.id } };
  }

  const [orders, clients, users, equipment] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        assignees: { select: { id: true, name: true } },
        _count: { select: { items: true, tasks: true } },
      },
      take: 100,
    }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { isBlocked: false },
      select: { id: true, name: true, role: true },
    }),
    prisma.equipment.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <OrdersClient
      initialOrders={orders.map((o) => ({
        ...o,
        amount: Number(o.amount),
        createdAt: o.createdAt.toISOString(),
        deadline: o.deadline?.toISOString() || null,
        updatedAt: o.updatedAt.toISOString(),
      }))}
      clients={clients}
      users={users}
      equipment={equipment}
      currentUserId={session?.user.id || ""}
      currentRole={session?.user.role || "MANAGER"}
    />
  );
}
