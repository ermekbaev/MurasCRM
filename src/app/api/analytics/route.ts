import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { startOfWeek, startOfMonth, startOfQuarter, startOfYear, subMonths, subWeeks, format } from "date-fns";

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "month";

  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;
  let prevStartDate: Date;

  if (period === "custom") {
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    startDate = fromParam ? new Date(fromParam) : startOfMonth(now);
    endDate = toParam ? new Date(toParam + "T23:59:59.999") : now;
    const rangeMs = endDate.getTime() - startDate.getTime();
    prevStartDate = new Date(startDate.getTime() - rangeMs);
  } else {
    switch (period) {
      case "week":
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        prevStartDate = subWeeks(startDate, 1);
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
    operatorEarningsItems,
    materialCostsAgg,
    prevMaterialCostsAgg,
    prevEarningsItems,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { createdAt: { gte: startDate, lte: endDate }, status: { not: "CANCELLED" } },
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
      where: { createdAt: { gte: startDate, lte: endDate } },
      _count: true,
    }),
    prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: startDate, lte: endDate }, status: { not: "CANCELLED" } } },
      select: { total: true, equipmentId: true, equipment: { select: { name: true, type: true } } },
    }),
    prisma.order.groupBy({
      by: ["priority"],
      where: { createdAt: { gte: startDate, lte: endDate } },
      _count: true,
    }),
    prisma.orderItem.groupBy({
      by: ["name"],
      where: {
        order: { createdAt: { gte: startDate, lte: endDate }, status: { not: "CANCELLED" } },
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
        createdAt: { gte: subMonths(endDate, 11), lte: endDate },
        status: { not: "CANCELLED" },
      },
      _sum: { amount: true },
    }),
    // Operator load: tasks count per assignee in period
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        createdAt: { gte: startDate, lte: endDate },
        assigneeId: { not: null },
      },
      _count: true,
    }),
    // Equipment load via active order items
    prisma.orderItem.findMany({
      where: {
        order: { status: { in: ["NEW", "IN_PROGRESS"] } },
        equipmentId: { not: null },
      },
      select: { equipmentId: true },
    }),
    // Operator earnings: items linked to equipment in period
    prisma.orderItem.findMany({
      where: {
        order: { createdAt: { gte: startDate, lte: endDate }, status: { not: "CANCELLED" } },
        equipmentId: { not: null },
      },
      select: {
        qty: true,
        equipment: { select: { operatorRate: true, costPerLm: true, pricingUnit: true } },
        order: { select: { assignees: { select: { id: true, name: true } } } },
      },
    }),
    // Material costs: consumable write-offs in period
    prisma.consumableMovement.aggregate({
      where: {
        direction: "OUT",
        date: { gte: startDate, lte: endDate },
      },
      _sum: { totalCost: true },
    }),
    // Previous period material costs
    prisma.consumableMovement.aggregate({
      where: {
        direction: "OUT",
        date: { gte: prevStartDate, lt: startDate },
      },
      _sum: { totalCost: true },
    }),
    // Previous period operator earnings items (for correct prevExpenses)
    prisma.orderItem.findMany({
      where: {
        order: { createdAt: { gte: prevStartDate, lt: startDate }, status: { not: "CANCELLED" } },
        equipmentId: { not: null },
      },
      select: {
        qty: true,
        equipment: { select: { operatorRate: true, costPerLm: true } },
      },
    }),
  ]);

  // Revenue by equipment
  const eqRevenueMap: Record<string, { name: string; type: string; count: number; revenue: number }> = {};
  ordersByServiceType.forEach((item) => {
    const key = item.equipmentId || "__none__";
    const label = item.equipment?.name || "Прочее";
    const type = item.equipment?.type || "";
    if (!eqRevenueMap[key]) eqRevenueMap[key] = { name: label, type, count: 0, revenue: 0 };
    eqRevenueMap[key].count++;
    eqRevenueMap[key].revenue += Number(item.total);
  });
  const serviceTypeData = Object.values(eqRevenueMap).sort((a, b) => b.revenue - a.revenue);

  // Process monthly revenue (relative to endDate)
  const monthlyMap: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const key = format(subMonths(endDate, i), "MM.yyyy");
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

  // Aggregate equipment load from active order items
  const eqCountMap: Record<string, number> = {};
  equipmentLoad.forEach((item) => {
    if (item.equipmentId) eqCountMap[item.equipmentId] = (eqCountMap[item.equipmentId] || 0) + 1;
  });
  const equipmentIds = Object.keys(eqCountMap);
  const equipmentList = equipmentIds.length > 0
    ? await prisma.equipment.findMany({ where: { id: { in: equipmentIds } }, select: { id: true, name: true, type: true } })
    : [];
  const equipmentMap = Object.fromEntries(equipmentList.map((e) => [e.id, e]));

  // Aggregate operator earnings per operator (only items where equipment has operatorRate set)
  const earningsMap: Record<string, { name: string; earnings: number; qty: number }> = {};
  for (const item of operatorEarningsItems) {
    const rate = item.equipment?.operatorRate ? Number(item.equipment.operatorRate) : 0;
    if (rate === 0) continue;
    const qty = Number(item.qty);
    for (const op of item.order.assignees) {
      if (!earningsMap[op.id]) earningsMap[op.id] = { name: op.name, earnings: 0, qty: 0 };
      earningsMap[op.id].earnings += qty * rate;
      earningsMap[op.id].qty += qty;
    }
  }
  const operatorEarnings = Object.values(earningsMap).sort((a, b) => b.earnings - a.earnings);

  const currentRev = Number(currentRevenue._sum.amount || 0);
  const prevRev = Number(prevRevenue._sum.amount || 0);
  const revGrowth = prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : null;
  const avgCheck = currentRevenue._count > 0 ? currentRev / currentRevenue._count : 0;

  const totalOperatorWages = Object.values(earningsMap).reduce((s, o) => s + o.earnings, 0);
  const materialCosts = Number(materialCostsAgg._sum.totalCost || 0);
  const prevMaterialCosts = Number(prevMaterialCostsAgg._sum.totalCost || 0);

  // Production cost (себестоимость): costPerLm × qty for each order item
  let productionCost = 0;
  for (const item of operatorEarningsItems) {
    const cost = item.equipment?.costPerLm ? Number(item.equipment.costPerLm) : 0;
    productionCost += Number(item.qty) * cost;
  }

  let prevProductionCost = 0;
  let prevOperatorWages = 0;
  for (const item of prevEarningsItems) {
    const cost = item.equipment?.costPerLm ? Number(item.equipment.costPerLm) : 0;
    prevProductionCost += Number(item.qty) * cost;
    const rate = item.equipment?.operatorRate ? Number(item.equipment.operatorRate) : 0;
    prevOperatorWages += Number(item.qty) * rate;
  }

  const totalExpenses = materialCosts + totalOperatorWages + productionCost;
  const profit = currentRev - totalExpenses;
  const prevExpenses = prevMaterialCosts + prevOperatorWages + prevProductionCost;
  const prevProfit = prevRev - prevExpenses;
  const profitGrowth = prevProfit !== 0 ? ((profit - prevProfit) / Math.abs(prevProfit)) * 100 : null;

  return NextResponse.json({
    summary: {
      revenue: currentRev,
      prevRevenue: prevRev,
      revGrowth,
      ordersCount: currentRevenue._count,
      prevOrdersCount: prevRevenue._count,
      avgCheck,
      materialCosts,
      operatorWages: totalOperatorWages,
      productionCost,
      totalExpenses,
      profit,
      prevProfit,
      profitGrowth,
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
    equipmentLoad: equipmentIds
      .filter((id) => equipmentMap[id])
      .map((id) => ({
        name: equipmentMap[id].name,
        type: equipmentMap[id].type,
        orders: eqCountMap[id],
      }))
      .sort((a, b) => b.orders - a.orders),
    operatorEarnings,
  });
}
