import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/**
 * Быстрый поиск по системе (Ctrl+K).
 *
 * Заявки, клиенты и счета — по номеру, названию, телефону, ИНН. Каждый раздел
 * отдаётся, только если роль имеет к нему доступ: дизайнер не увидит счета,
 * оператор — клиентов. Так поиск не становится дырой в разграничении.
 */
export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ orders: [], clients: [], invoices: [] });

  const role = session.user.role;
  const like = { contains: q, mode: "insensitive" as const };
  const canOrders = ["ADMIN", "MANAGER", "DESIGNER", "OPERATOR"].includes(role);
  const canClients = ["ADMIN", "MANAGER"].includes(role);
  const canInvoices = ["ADMIN", "MANAGER", "ACCOUNTANT"].includes(role);

  const [orders, clients, invoices] = await Promise.all([
    canOrders
      ? prisma.order.findMany({
          where: { OR: [{ number: like }, { title: like }] },
          select: { id: true, number: true, title: true, status: true, client: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 6,
        })
      : [],
    canClients
      ? prisma.client.findMany({
          where: { OR: [{ name: like }, { phone: { contains: q } }, { inn: { contains: q } }] },
          select: { id: true, name: true, phone: true, inn: true },
          orderBy: { createdAt: "desc" },
          take: 6,
        })
      : [],
    canInvoices
      ? prisma.invoice.findMany({
          where: { number: like },
          select: { id: true, number: true, total: true, client: { select: { name: true } } },
          orderBy: { date: "desc" },
          take: 6,
        })
      : [],
  ]);

  return NextResponse.json({
    orders,
    clients,
    invoices: invoices.map((i) => ({ ...i, total: Number(i.total) })),
  });
}
