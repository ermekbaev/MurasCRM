import { prisma } from "@/lib/prisma";
import InvoicesClient from "./InvoicesClient";

export default async function InvoicesPage() {
  const [invoices, clients, orders] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { date: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        order: { select: { id: true, number: true } },
        items: true,
      },
      take: 100,
    }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.order.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { id: true, number: true, client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <InvoicesClient
      initialInvoices={invoices.map((i) => ({
        ...i,
        vatRate: Number(i.vatRate),
        subtotal: Number(i.subtotal),
        vatAmount: Number(i.vatAmount),
        total: Number(i.total),
        date: i.date.toISOString(),
        dueDate: i.dueDate?.toISOString() || null,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
        items: i.items.map((item) => ({
          ...item,
          qty: Number(item.qty),
          price: Number(item.price),
          total: Number(item.total),
        })),
      }))}
      clients={clients}
      orders={orders}
    />
  );
}
