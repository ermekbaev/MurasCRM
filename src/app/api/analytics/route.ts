import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, startOfMonth, startOfQuarter, startOfYear, subMonths, format } from "date-fns";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "month";

  const now = new Date();
  let startDate: Date;
  let prevStartDate: Date;

  switch (period) {
    case "week":
      startDate = startOfWeek(now, { weekStartsOn: 1 });
      prevStartDate = startOfWeek(subMonths(now, 0.25), { weekStartsOn: 1 });
      break;
    case "quarter":
      startDate = startOfQuarter(now);
      prevStartDate = startOfQuarter(subMonths(now, 3));
      break;
    case "year":
      startDate = startOfYear(now);
      prevStartDate = startOfYear(subMonths(now, 12));
      break;
    default:
      startDate = startOfMonth(now);
      prevStartDate = startOfMonth(subMonths(now, 1));
  }

  const [
    currentRevenue,
    prevRevenue,
    ordersByStatus,
    ordersByServiceType,
    ordersByPriority,
    topServices,
    revenueByMonth,
    operatorLoad,
    equipmentLoad,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { createdAt: { gte: startDate }, status: { not: "CANCELLED" } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: prevStartDate, lt: startDate },
        status: { not: "CANCELLED" },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: startDate }, status: { not: "CANCELLED" } } },
      select: { total: true, service: { select: { type: true } } },
    }),
    prisma.order.groupBy({
      by: ["priority"],
      where: { createdAt: { gte: startDate } },
      _count: true,
    }),
    prisma.orderItem.groupBy({
      by: ["name"],
      where: {
        order: { createdAt: { gte: startDate }, status: { not: "CANCELLED" } },
      },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }),
    // Monthly revenue for last 12 months
    prisma.order.groupBy({
      by: ["createdAt"],
      where: {
        createdAt: { gte: subMonths(now, 11) },
        status: { not: "CANCELLED" },
      },
      _sum: { amount: true },
    }),
    // Operator load: tasks count per assignee in period
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        createdAt: { gte: startDate },
        assigneeId: { not: null },
      },
      _count: true,
    }),
    // Equipment load: active orders per equipment
    prisma.order.groupBy({
      by: ["equipmentId"],
      where: {
        equipmentId: { not: null },
        status: { in: ["NEW", "IN_PROGRESS"] },
      },
      _count: true,
    }),
  ]);

  // Aggregate items by service type
  const svcTypeMap: Record<string, { count: number; revenue: number }> = {};
  ordersByServiceType.forEach((item) => {
    const type = item.service?.type || "OTHER";
    if (!svcTypeMap[type]) svcTypeMap[type] = { count: 0, revenue: 0 };
    svcTypeMap[type].count++;
    svcTypeMap[type].revenue += Number(item.total);
  });
  const serviceTypeData = Object.entries(svcTypeMap)
    .map(([type, d]) => ({ type, count: d.count, revenue: d.revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // Process monthly revenue
  const monthlyMap: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const key = format(subMonths(now, i), "MM.yyyy");
    monthlyMap[key] = 0;
  }
  revenueByMonth.forEach((r) => {
    const key = format(new Date(r.createdAt), "MM.yyyy");
    if (key in monthlyMap) {
      monthlyMap[key] = (monthlyMap[key] || 0) + Number(r._sum.amount || 0);
    }
  });

  // Resolve operator names
  const operatorIds = operatorLoad.map((o) => o.assigneeId!).filter(Boolean);
  const operators = operatorIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: operatorIds } }, select: { id: true, name: true, role: true } })
    : [];
  const operatorMap = Object.fromEntries(operators.map((u) => [u.id, u]));

  // Resolve equipment names
  const equipmentIds = equipmentLoad.map((e) => e.equipmentId!).filter(Boolean);
  const equipmentList = equipmentIds.length > 0
    ? await prisma.equipment.findMany({ where: { id: { in: equipmentIds } }, select: { id: true, name: true, type: true } })
    : [];
  const equipmentMap = Object.fromEntries(equipmentList.map((e) => [e.id, e]));

  const currentRev = Number(currentRevenue._sum.amount || 0);
  const prevRev = Number(prevRevenue._sum.amount || 0);
  const revGrowth = prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : null;
  const avgCheck = currentRevenue._count > 0 ? currentRev / currentRevenue._count : 0;

  return NextResponse.json({
    summary: {
      revenue: currentRev,
      prevRevenue: prevRev,
      revGrowth,
      ordersCount: currentRevenue._count,
      prevOrdersCount: prevRevenue._count,
      avgCheck,
    },
    ordersByStatus: ordersByStatus.map((o) => ({ status: o.status, count: o._count })),
    ordersByType: serviceTypeData,
    ordersByPriority: ordersByPriority.map((o) => ({ priority: o.priority, count: o._count })),
    topServices: topServices.map((s) => ({
      name: s.name,
      count: s._count,
      revenue: Number(s._sum.total || 0),
    })),
    monthlyRevenue: Object.entries(monthlyMap).map(([month, amount]) => ({ month, amount })),
    operatorLoad: operatorLoad
      .filter((o) => o.assigneeId && operatorMap[o.assigneeId])
      .map((o) => ({
        name: operatorMap[o.assigneeId!]?.name || "—",
        role: operatorMap[o.assigneeId!]?.role || "",
        tasks: o._count,
      }))
      .sort((a, b) => b.tasks - a.tasks),
    equipmentLoad: equipmentLoad
      .filter((e) => e.equipmentId && equipmentMap[e.equipmentId])
      .map((e) => ({
        name: equipmentMap[e.equipmentId!]?.name || "—",
        type: equipmentMap[e.equipmentId!]?.type || "",
        orders: e._count,
      }))
      .sort((a, b) => b.orders - a.orders),
  });
}
