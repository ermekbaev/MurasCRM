import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

const calcSchema = z.object({
  type: z.enum(["DTF", "UV_DTF", "UV_FLATBED", "LASER_CUT", "PLOTTER_CUT", "HIGH_PRECISION"]),
  width: z.number().optional(),
  height: z.number().optional(),
  quantity: z.number().optional(),
  cutLength: z.number().optional(),
  material: z.string().optional(),
  pricePerUnit: z.number().optional(),
  costPricePerUnit: z.number().optional(),
  filmPrice: z.number().optional(),
  filmCostPrice: z.number().optional(),
  laminationGloss: z.boolean().optional(),
  laminationMatte: z.boolean().optional(),
  laminationCostPrice: z.number().optional(),
  urgency: z.boolean().optional(),
  urgencyPercent: z.number().optional(),
  discountQty: z.array(z.object({ minQty: z.number(), discountPct: z.number() })).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = calcSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const {
    type,
    width = 0,
    height = 0,
    quantity = 1,
    cutLength = 0,
    pricePerUnit = 0,
    costPricePerUnit = 0,
    filmPrice = 0,
    filmCostPrice = 0,
    laminationGloss,
    laminationMatte,
    laminationCostPrice = 0,
    urgency,
    urgencyPercent = 30,
    discountQty = [],
  } = parsed.data;

  const area = width * height;
  let baseCost = 0;
  let materialCost = 0;
  let baseCostPrice = 0;
  let materialCostPrice = 0;
  let breakdown: { label: string; value: number }[] = [];

  switch (type) {
    case "DTF": {
      baseCost = area * pricePerUnit;
      materialCost = area * filmPrice;
      baseCostPrice = area * costPricePerUnit;
      materialCostPrice = area * filmCostPrice;
      breakdown = [
        { label: `Печать ${area.toFixed(3)} м²`, value: baseCost },
        { label: "Плёнка", value: materialCost },
      ];
      break;
    }
    case "UV_DTF": {
      baseCost = area * pricePerUnit * quantity;
      baseCostPrice = area * costPricePerUnit * quantity;
      breakdown = [
        { label: `UV DTF ${area.toFixed(3)} м² × ${quantity} шт`, value: baseCost },
      ];
      break;
    }
    case "UV_FLATBED": {
      baseCost = area * pricePerUnit;
      baseCostPrice = area * costPricePerUnit;
      breakdown = [
        { label: `UV планшет ${area.toFixed(3)} м²`, value: baseCost },
      ];
      break;
    }
    case "LASER_CUT": {
      baseCost = cutLength * pricePerUnit;
      baseCostPrice = cutLength * costPricePerUnit;
      breakdown = [
        { label: `Лазерная резка ${cutLength} мм`, value: baseCost },
      ];
      break;
    }
    case "PLOTTER_CUT": {
      baseCost = cutLength * pricePerUnit;
      baseCostPrice = cutLength * costPricePerUnit;
      breakdown = [
        { label: `Плоттерная резка ${cutLength} пог.м`, value: baseCost },
      ];
      break;
    }
    case "HIGH_PRECISION": {
      baseCost = area * pricePerUnit;
      baseCostPrice = area * costPricePerUnit;
      breakdown = [
        { label: `Печать ${area.toFixed(3)} м²`, value: baseCost },
      ];
      break;
    }
  }

  let subtotal = baseCost + materialCost;
  let costTotal = baseCostPrice + materialCostPrice;

  // Lamination
  const laminationPrice = 400;
  if (laminationGloss || laminationMatte) {
    const laminCost = area * laminationPrice;
    const laminCostPrice = area * (laminationCostPrice || laminationPrice * 0.4);
    subtotal += laminCost;
    costTotal += laminCostPrice;
    breakdown.push({ label: `Ламинация ${laminationGloss ? "глянец" : "мат"}`, value: laminCost });
  }

  // Quantity discount
  let discountPct = 0;
  if (discountQty.length > 0) {
    const applicableTier = discountQty
      .filter((d) => quantity >= d.minQty)
      .sort((a, b) => b.minQty - a.minQty)[0];
    if (applicableTier) discountPct = applicableTier.discountPct;
  }

  const discountAmount = (subtotal * discountPct) / 100;
  subtotal -= discountAmount;
  if (discountAmount > 0) {
    breakdown.push({ label: `Скидка ${discountPct}% за тираж`, value: -discountAmount });
  }

  // Urgency
  if (urgency && urgencyPercent > 0) {
    const urgencyCost = (subtotal * urgencyPercent) / 100;
    subtotal += urgencyCost;
    breakdown.push({ label: `Срочность +${urgencyPercent}%`, value: urgencyCost });
  }

  const margin = costTotal > 0 ? ((subtotal - costTotal) / subtotal) * 100 : null;

  return NextResponse.json({
    subtotal,
    costTotal: costTotal > 0 ? costTotal : null,
    margin,
    breakdown,
    pricePerUnit: quantity > 1 ? subtotal / quantity : null,
    area: type !== "LASER_CUT" && type !== "PLOTTER_CUT" ? area : null,
  });
}
