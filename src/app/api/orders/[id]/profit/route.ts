import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/**
 * Прибыль по заявке: выручка минус себестоимость.
 *
 * Себестоимость складывается из тех же частей, что и в аналитике:
 *  — материалы: списания расходников по этой заявке (ConsumableMovement OUT);
 *  — производство: qty × costPerLm оборудования по позициям;
 *  — работа оператора: qty × operatorRate оборудования по позициям.
 *
 * Это деньги владельца, поэтому только администратору.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      amount: true,
      items: {
        select: {
          qty: true,
          equipment: { select: { costPerLm: true, operatorRate: true } },
        },
      },
    },
  });
  if (!order) return apiError.notFound();

  let productionCost = 0;
  let operatorWages = 0;
  for (const it of order.items) {
    const qty = Number(it.qty);
    productionCost += qty * Number(it.equipment?.costPerLm ?? 0);
    operatorWages += qty * Number(it.equipment?.operatorRate ?? 0);
  }

  const materialAgg = await prisma.consumableMovement.aggregate({
    where: { orderId: id, direction: "OUT" },
    _sum: { totalCost: true },
  });
  const materialCost = Number(materialAgg._sum.totalCost ?? 0);

  const round = (n: number) => Math.round(n * 100) / 100;
  const revenue = Number(order.amount);
  const cost = round(materialCost + productionCost + operatorWages);
  const profit = round(revenue - cost);
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : null;

  return NextResponse.json({
    revenue,
    materialCost: round(materialCost),
    productionCost: round(productionCost),
    operatorWages: round(operatorWages),
    cost,
    profit,
    margin,
  });
}
