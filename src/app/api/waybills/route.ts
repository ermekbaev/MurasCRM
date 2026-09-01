import { NextResponse } from "next/server";
import { requireAuth, apiError, retryOnDuplicate } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { nextDocumentNumber } from "@/lib/numbering.server";
import { z } from "zod";

const itemSchema = z.object({
  name: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string(),
  price: z.number().nonnegative(),
});

const waybillSchema = z.object({
  invoiceId: z.string().optional(),
  orderId: z.string().optional(),
  companyId: z.string().optional(),
  clientId: z.string().optional(),
  payerId: z.string().optional(),
  consigneeId: z.string().optional(),
  number: z.string().optional(),
  date: z.string().optional(),
  basis: z.string().optional(),
  items: z.array(itemSchema).optional(),
});

const WAYBILL_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT"];

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();

  const { searchParams } = new URL(req.url);
  const q = z
    .object({
      page: z.coerce.number().int().positive().max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    })
    .parse(Object.fromEntries(searchParams));

  const [waybills, total] = await Promise.all([
    prisma.waybill.findMany({
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      orderBy: { date: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        payer: { select: { id: true, name: true } },
        consignee: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true, date: true } },
        order: { select: { id: true, number: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.waybill.count(),
  ]);

  return NextResponse.json({
    waybills: waybills.map((w) => ({ ...w, total: Number(w.total) })),
    total,
    page: q.page,
    pages: Math.ceil(total / q.limit),
  });
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!WAYBILL_ROLES.includes(session.user.role)) return apiError.forbidden();

  const parsed = waybillSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  const { invoiceId, items, number: numberOverride, date, basis, ...rest } = parsed.data;

  // Накладная обычно делается на основании счёта: позиции, контрагент,
  // компания-поставщик и текст основания берутся оттуда, если не переданы явно.
  let sourceInvoice = null;
  if (invoiceId) {
    sourceInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
    if (!sourceInvoice) return apiError.badRequest("Счёт-основание не найден");
  }

  const resolvedItems = (items?.length ? items : sourceInvoice?.items.map((i) => ({
    name: i.name,
    qty: Number(i.qty),
    unit: i.unit,
    price: Number(i.price),
  }))) ?? [];

  if (resolvedItems.length === 0) {
    return apiError.badRequest("Добавьте хотя бы одну позицию");
  }

  const clientId = rest.clientId?.trim() || sourceInvoice?.clientId;
  if (!clientId) return apiError.badRequest("Укажите контрагента");

  const companyId = rest.companyId?.trim() || sourceInvoice?.companyId || undefined;
  const orderId = rest.orderId?.trim() || sourceInvoice?.orderId || undefined;

  const resolvedBasis =
    basis?.trim() ||
    (sourceInvoice
      ? `Счёт № ${sourceInvoice.number} от ${sourceInvoice.date.toLocaleDateString("ru-RU")}`
      : undefined);

  const calculatedItems = resolvedItems.map((i) => ({ ...i, total: i.qty * i.price }));
  const total = calculatedItems.reduce((sum, i) => sum + i.total, 0);

  const waybill = await retryOnDuplicate(async (attempt) => {
    const number = numberOverride?.trim()
      ? numberOverride.trim()
      : await nextDocumentNumber("waybill", attempt);

    return prisma.waybill.create({
      data: {
        number,
        invoiceId: invoiceId || undefined,
        orderId,
        companyId,
        clientId,
        payerId: rest.payerId?.trim() || undefined,
        consigneeId: rest.consigneeId?.trim() || undefined,
        date: date ? new Date(date) : undefined,
        basis: resolvedBasis,
        total,
        items: { create: calculatedItems },
      },
      include: {
        client: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true } },
        items: true,
      },
    });
  });

  return NextResponse.json({ ...waybill, total: Number(waybill.total) }, { status: 201 });
}
