import { prisma } from "@/lib/prisma";
import { formatDate, formatCurrency } from "@/lib/utils";
import { CLIENT_TYPE_LABELS, CLIENT_SOURCE_LABELS } from "@/lib/constants";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { Users, Plus, Phone, Mail, Building2 } from "lucide-react";
import ClientsClient from "./ClientsClient";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { orders: true } },
      orders: {
        where: { status: { not: "CANCELLED" } },
        select: { amount: true },
      },
    },
    take: 50,
  });

  const data = clients.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    inn: c.inn,
    kpp: c.kpp,
    ogrn: c.ogrn,
    phone: c.phone,
    email: c.email,
    telegram: c.telegram,
    whatsapp: c.whatsapp,
    legalAddress: c.legalAddress,
    bankName: c.bankName,
    bankAccount: c.bankAccount,
    bankBik: c.bankBik,
    corrAccount: c.corrAccount,
    source: c.source,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    ordersCount: c._count.orders,
    totalAmount: c.orders.reduce((sum, o) => sum + Number(o.amount), 0),
  }));

  return <ClientsClient initialData={data} />;
}
