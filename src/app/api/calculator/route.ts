import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

const calcSchema = z.object({
  type: z.string(),
  pricingUnit: z.enum(["LM", "SQM", "PCS", "CUT"]).default("LM"),
  width: z.number().optional(),
  height: z.number().optional(),
  qty: z.number().optional(),
  cutLength: z.number().optional(),
  pricePerUnit: z.number().optional(),
  costPricePerUnit: z.number().optional(),
  urgency: z.boolean().optional(),
  urgencyPercent: z.number().optional(),
  discountQty: z.array(z.object({ minQty: z.number(), discountPct: z.number() })).optional(),
});

const UNIT_LABELS: Record<string, string> = {
  DTF: "DTF-печать",
  UV_DTF: "UV DTF",
  UV_FLATBED: "UV планшет",
  LASER_CUT: "Лазерная резка",
  PLOTTER_CUT: "Плоттерная резка",
  HIGH_PRECISION: "Высокоточная печать",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = calcSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const {
    type,
    pricingUnit,
    width = 0,
    height = 0,
    qty = 0,
    cutLength = 0,
    pricePerUnit = 0,
    costPricePerUnit = 0,
    urgency,
    urgencyPercent = 30,
    discountQty = [],
  } = parsed.data;

  const label = UNIT_LABELS[type] || type;
  let baseCost = 0;
  let baseCostPrice = 0;
  let breakdown: { label: string; value: number }[] = [];
  let area: number | null = null;
  let discountBase: number = 0; // value used for discount tier comparison

  switch (pricingUnit) {
    case "LM": {
      baseCost = height * pricePerUnit;
      baseCostPrice = height * costPricePerUnit;
      area = width > 0 ? width * height : null;
      discountBase = height;
      breakdown = [{ label: `${label} ${height.toFixed(2)} пог.м`, value: baseCost }];
      break;
    }
    case "SQM": {
      const sqm = width * height;
      baseCost = sqm * pricePerUnit;
      baseCostPrice = sqm * costPricePerUnit;
      area = sqm;
      discountBase = sqm;
      breakdown = [{ label: `${label} ${sqm.toFixed(4)} м²`, value: baseCost }];
      break;
    }
    case "PCS": {
      baseCost = qty * pricePerUnit;
      baseCostPrice = qty * costPricePerUnit;
      discountBase = qty;
      breakdown = [{ label: `${label} ${qty} шт`, value: baseCost }];
      break;
    }
    case "CUT": {
      baseCost = cutLength * pricePerUnit;
      baseCostPrice = cutLength * costPricePerUnit;
      discountBase = cutLength;
      const cutLabel = type === "LASER_CUT" ? `${cutLength} мм` : `${cutLength} пог.м`;
      breakdown = [{ label: `${label} ${cutLabel}`, value: baseCost }];
      break;
    }
  }

  let subtotal = baseCost;
  let costTotal = baseCostPrice;

  if (discountQty.length > 0) {
    const applicableTier = discountQty
      .filter((d) => discountBase >= d.minQty)
      .sort((a, b) => b.minQty - a.minQty)[0];
    if (applicableTier) {
      const discountAmount = (subtotal * applicableTier.discountPct) / 100;
      subtotal -= discountAmount;
      breakdown.push({ label: `Скидка ${applicableTier.discountPct}%`, value: -discountAmount });
    }
  }

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
    pricePerUnit: null,
    area,
  });
}
