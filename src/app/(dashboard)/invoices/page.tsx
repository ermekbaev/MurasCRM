import { prisma } from "@/lib/prisma";
import InvoicesClient from "./InvoicesClient";

export default async function InvoicesPage() {
  const [clients, orders, companies] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.order.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { id: true, number: true, client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return <InvoicesClient clients={clients} orders={orders} companies={companies} />;
}
