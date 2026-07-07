import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { startOfWeek, startOfMonth, startOfQuarter, startOfYear, subMonths, subWeeks, format } from "date-fns";
import {
  ORDER_STATUS_LABELS,
  PRIORITY_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants";
import { getOrderTypeLabels } from "@/lib/orderTypes";

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

  const materialCosts = Number(materialCostsAgg._sum.totalCost || 0);
  const prevMaterialCosts = Number(prevMaterialCostsAgg._sum.totalCost || 0);

  // Себестоимость + ЗП операторов: считаем один раз на позицию (как и для прошлого периода).
  // earningsMap выше — отдельная разбивка по операторам для отображения, а не для суммы расходов.
  let productionCost = 0;
  let totalOperatorWages = 0;
  for (const item of operatorEarningsItems) {
    const qty = Number(item.qty);
    productionCost += qty * (item.equipment?.costPerLm ? Number(item.equipment.costPerLm) : 0);
    totalOperatorWages += qty * (item.equipment?.operatorRate ? Number(item.equipment.operatorRate) : 0);
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

  // Detailed breakdown (only when requested — used for Excel export)
  let details: {
    orders: {
      number: string;
      date: string;
      client: string;
      type: string;
      status: string;
      priority: string;
      amount: number;
      paymentStatus: string;
      itemsCount: number;
    }[];
    items: {
      orderNumber: string;
      date: string;
      name: string;
      equipment: string;
      qty: number;
      unit: string;
      price: number;
      total: number;
    }[];
    byEquipment: {
      name: string;
      type: string;
      itemsCount: number;
      qty: number;
      revenue: number;
    }[];
  } | undefined;

  if (searchParams.get("detailed")) {
    const detailOrders = await prisma.order.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "asc" },
      select: {
        number: true,
        createdAt: true,
        type: true,
        status: true,
        priority: true,
        amount: true,
        paymentStatus: true,
        client: { select: { name: true } },
        items: {
          select: {
            name: true,
            qty: true,
            unit: true,
            price: true,
            total: true,
            equipment: { select: { name: true, type: true } },
          },
        },
      },
    });

    const ORDER_TYPE_LABELS = await getOrderTypeLabels();
    const eqAgg: Record<string, { name: string; type: string; itemsCount: number; qty: number; revenue: number }> = {};
    const orderRows: NonNullable<typeof details>["orders"] = [];
    const itemRows: NonNullable<typeof details>["items"] = [];

    for (const o of detailOrders) {
      const dateStr = format(new Date(o.createdAt), "dd.MM.yyyy");
      orderRows.push({
        number: o.number,
        date: dateStr,
        client: o.client?.name || "—",
        type: ORDER_TYPE_LABELS[o.type] || o.type,
        status: ORDER_STATUS_LABELS[o.status] || o.status,
        priority: PRIORITY_LABELS[o.priority] || o.priority,
        amount: Number(o.amount),
        paymentStatus: PAYMENT_STATUS_LABELS[o.paymentStatus] || o.paymentStatus,
        itemsCount: o.items.length,
      });

      for (const it of o.items) {
        const eqName = it.equipment?.name || "Без оборудования";
        const eqType = it.equipment?.type || "";
        const qty = Number(it.qty);
        const total = Number(it.total);
        itemRows.push({
          orderNumber: o.number,
          date: dateStr,
          name: it.name,
          equipment: eqName,
          qty,
          unit: it.unit,
          price: Number(it.price),
          total,
        });
        if (!eqAgg[eqName]) eqAgg[eqName] = { name: eqName, type: eqType, itemsCount: 0, qty: 0, revenue: 0 };
        eqAgg[eqName].itemsCount++;
        eqAgg[eqName].qty += qty;
        eqAgg[eqName].revenue += total;
      }
    }

    details = {
      orders: orderRows,
      items: itemRows,
      byEquipment: Object.values(eqAgg).sort((a, b) => b.revenue - a.revenue),
    };
  }

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
    details,
  });
}
