import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string().min(1),
  price: z.number().nonnegative(),
});

const patchSchema = z.object({
  isPaid: z.boolean().optional(),
  dueDate: z.string().nullable().optional(),
  basis: z.string().nullable().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  items: z.array(itemSchema).min(1).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      order: { select: { id: true, number: true } },
      items: true,
      acts: true,
    },
  });

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...invoice,
    subtotal: Number(invoice.subtotal),
    vatAmount: Number(invoice.vatAmount),
    total: Number(invoice.total),
    items: invoice.items.map((i) => ({ ...i, qty: Number(i.qty), price: Number(i.price), total: Number(i.total) })),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { items, vatRate, dueDate, basis, isPaid } = parsed.data;

  // If items provided — recalculate totals and replace items
  if (items) {
    const effectiveVatRate = vatRate ?? Number((await prisma.invoice.findUnique({ where: { id }, select: { vatRate: true } }))?.vatRate ?? 0);
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    const vatAmount = (subtotal * effectiveVatRate) / 100;
    const total = subtotal + vatAmount;

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          ...(isPaid !== undefined && { isPaid }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(basis !== undefined && { basis }),
          vatRate: effectiveVatRate,
          subtotal,
          vatAmount,
          total,
          items: {
            create: items.map((i) => ({
              name: i.name,
              qty: i.qty,
              unit: i.unit,
              price: i.price,
              total: i.qty * i.price,
            })),
          },
        },
        include: { items: true },
      });
    });

    return NextResponse.json({
      ...invoice,
      subtotal: Number(invoice.subtotal),
      vatAmount: Number(invoice.vatAmount),
      total: Number(invoice.total),
      items: invoice.items.map((i) => ({ ...i, qty: Number(i.qty), price: Number(i.price), total: Number(i.total) })),
    });
  }

  // Simple field update (isPaid, dueDate, basis)
  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      ...(isPaid !== undefined && { isPaid }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(basis !== undefined && { basis }),
      ...(vatRate !== undefined && { vatRate }),
    },
  });

  return NextResponse.json(invoice);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  await prisma.invoice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
