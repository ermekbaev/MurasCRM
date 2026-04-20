import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, startOfMonth, startOfQuarter, startOfYear, subDays, format } from "date-fns";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "month";

  const now = new Date();
  let startDate: Date;
  switch (period) {
    case "week": startDate = startOfWeek(now, { weekStartsOn: 1 }); break;
    case "quarter": startDate = startOfQuarter(now); break;
    case "year": startDate = startOfYear(now); break;
    default: startDate = startOfMonth(now);
  }

  const [
    totalOrders,
    activeOrders,
    completedOrders,
    revenue,
    newOrdersWithoutAssignee,
    lowStockConsumables,
    recentOrders,
    topClients,
    revenueByDay,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: ["NEW", "IN_PROGRESS", "REVIEW"] } } }),
    prisma.order.count({ where: { status: { in: ["READY", "ISSUED"] } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: startDate }, status: { not: "CANCELLED" } },
      _sum: { amount: true },
    }),
    prisma.order.count({
      where: { status: "NEW", assignees: { none: {} } },
    }),
    prisma.consumable.findMany({
      where: { stock: { lt: prisma.consumable.fields.minStock } },
      select: { id: true, name: true, stock: true, minStock: true, unit: true },
      take: 5,
    }).catch(() => []),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        client: { select: { name: true } },
      },
    }),
    prisma.client.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { orders: true } },
        orders: {
          where: { status: { not: "CANCELLED" } },
          select: { amount: true },
        },
      },
      take: 20,
    }),
    // Revenue for last 30 days
    prisma.order.groupBy({
      by: ["createdAt"],
      where: {
        createdAt: { gte: subDays(now, 30) },
        status: { not: "CANCELLED" },
      },
      _sum: { amount: true },
    }),
  ]);

  // Process top clients
  const topClientsProcessed = topClients
    .map((c) => ({
      id: c.id,
      name: c.name,
      ordersCount: c._count.orders,
      totalAmount: c.orders.reduce((sum, o) => sum + Number(o.amount), 0),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5);

  // Process daily revenue (last 30 days)
  const dailyMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = subDays(now, i);
    dailyMap[format(d, "dd.MM")] = 0;
  }
  revenueByDay.forEach((r) => {
    const key = format(new Date(r.createdAt), "dd.MM");
    if (key in dailyMap) {
      dailyMap[key] = (dailyMap[key] || 0) + Number(r._sum.amount || 0);
    }
  });
  const chartData = Object.entries(dailyMap).map(([date, amount]) => ({ date, amount }));

  // Low stock - raw SQL workaround
  const lowStock = await prisma.$queryRaw<
    { id: string; name: string; stock: number; minStock: number; unit: string }[]
  >`SELECT id, name, stock, "minStock", unit FROM "Consumable" WHERE stock < "minStock" LIMIT 5`.catch(() => []);

  return NextResponse.json({
    stats: {
      totalOrders,
      activeOrders,
      completedOrders,
      revenue: Number(revenue._sum.amount || 0),
      newOrdersWithoutAssignee,
    },
    lowStock,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      number: o.number,
      clientName: o.client.name,
      status: o.status,
      priority: o.priority,
      amount: Number(o.amount),
      createdAt: o.createdAt,
    })),
    topClients: topClientsProcessed,
    chartData,
  });
}
