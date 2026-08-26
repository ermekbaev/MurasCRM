import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  date: z.string().optional(),
  basis: z.string().nullable().optional(),
  payerId: z.string().nullable().optional(),
  consigneeId: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        name: z.string(),
        qty: z.number().positive(),
        unit: z.string(),
        price: z.number().nonnegative(),
      }),
    )
    .min(1)
    .optional(),
});

const WAYBILL_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT"];

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  const { id } = await params;

  const waybill = await prisma.waybill.findUnique({
    where: { id },
    include: {
      items: true,
      client: true,
      payer: true,
      consignee: true,
      invoice: { select: { id: true, number: true, date: true } },
      order: { select: { id: true, number: true } },
    },
  });

  if (!waybill) return apiError.notFound();
  return NextResponse.json({ ...waybill, total: Number(waybill.total) });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!WAYBILL_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  const { items, date, basis, payerId, consigneeId } = parsed.data;

  const calculatedItems = items?.map((i) => ({ ...i, total: i.qty * i.price }));
  const total = calculatedItems?.reduce((sum, i) => sum + i.total, 0);

  const waybill = await prisma.$transaction(async (tx) => {
    if (calculatedItems) {
      await tx.waybillItem.deleteMany({ where: { waybillId: id } });
      await tx.waybillItem.createMany({
        data: calculatedItems.map((i) => ({ ...i, waybillId: id })),
      });
    }
    return tx.waybill.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(basis !== undefined && { basis }),
        ...(payerId !== undefined && { payerId }),
        ...(consigneeId !== undefined && { consigneeId }),
        ...(total !== undefined && { total }),
      },
      include: {
        items: true,
        client: true,
        payer: true,
        consignee: true,
        invoice: { select: { id: true, number: true, date: true } },
        order: { select: { id: true, number: true } },
      },
    });
  });

  return NextResponse.json({ ...waybill, total: Number(waybill.total) });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const waybill = await prisma.waybill.findUnique({ where: { id }, select: { id: true } });
  if (!waybill) return apiError.notFound();

  await prisma.waybill.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
