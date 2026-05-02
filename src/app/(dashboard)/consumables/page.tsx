import { prisma } from "@/lib/prisma";
import ConsumablesClient from "./ConsumablesClient";

export default async function ConsumablesPage() {
  const [consumables, suppliers] = await Promise.all([
    prisma.consumable.findMany({
      orderBy: { name: "asc" },
      take: 50,
      include: {
        supplier: { select: { id: true, name: true } },
        _count: { select: { movements: true } },
      },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <ConsumablesClient
      initialConsumables={consumables.map((c) => ({
        ...c,
        stock: Number(c.stock),
        minStock: Number(c.minStock),
        purchasePrice: Number(c.purchasePrice),
        writeoffPrice: Number(c.writeoffPrice),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        isLow: Number(c.stock) < Number(c.minStock),
      }))}
      suppliers={suppliers}
    />
  );
}
