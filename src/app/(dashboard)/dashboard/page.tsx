import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "@/lib/constants";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/layout/PageHeader";
import Badge from "@/components/ui/Badge";
import Link from "next/link";
import {
  LayoutDashboard,
  ShoppingCart,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  Package,
  Plus,
} from "lucide-react";
import { startOfMonth } from "date-fns";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import { Cpu } from "lucide-react";

async function getDashboardData() {
  const now = new Date();
  const startMonth = startOfMonth(now);

  const [
    totalOrders,
    activeOrders,
    completedOrders,
    revenue,
    newOrdersWithoutAssignee,
    recentOrders,
    topClients,
    lowStock,
    operatorTaskCounts,
    equipmentOrderCounts,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: ["NEW", "IN_PROGRESS", "REVIEW"] } } }),
    prisma.order.count({ where: { status: { in: ["READY", "ISSUED"] } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: startMonth }, status: { not: "CANCELLED" } },
      _sum: { amount: true },
    }),
    prisma.order.count({ where: { status: "NEW", assignees: { none: {} } } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { client: { select: { name: true } } },
    }),
    prisma.client.findMany({
      select: {
        id: true,
        name: true,
        orders: {
          where: { status: { not: "CANCELLED" } },
          select: { amount: true },
        },
      },
      take: 20,
    }),
    prisma.$queryRaw<
      { id: string; name: string; stock: string; minStock: string; unit: string }[]
    >`SELECT id, name, CAST(stock AS TEXT), CAST("minStock" AS TEXT), unit FROM "Consumable" WHERE stock < "minStock" LIMIT 5`,
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: { status: { in: ["TODO", "IN_PROGRESS"] }, assigneeId: { not: null } },
      _count: { id: true },
    }),
    prisma.orderItem.findMany({
      where: {
        order: { status: { in: ["NEW", "IN_PROGRESS", "REVIEW"] } },
        equipmentId: { not: null },
      },
      select: { equipmentId: true },
    }),
  ]);

  const topClientsProcessed = topClients
    .map((c) => ({
      id: c.id,
      name: c.name,
      ordersCount: c.orders.length,
      totalAmount: c.orders.reduce((sum, o) => sum + Number(o.amount), 0),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5);

  // Resolve operator names
  const operatorIds = operatorTaskCounts.map((r) => r.assigneeId!).filter(Boolean);
  const operators = operatorIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: operatorIds } }, select: { id: true, name: true, role: true } })
    : [];
  const operatorLoad = operatorTaskCounts
    .map((r) => ({
      id: r.assigneeId!,
      name: operators.find((u) => u.id === r.assigneeId)?.name || "—",
      role: operators.find((u) => u.id === r.assigneeId)?.role || "",
      activeTasks: r._count.id,
    }))
    .sort((a, b) => b.activeTasks - a.activeTasks);

  // Aggregate equipment load from active order items
  const eqCountMap: Record<string, number> = {};
  equipmentOrderCounts.forEach((item) => {
    if (item.equipmentId) eqCountMap[item.equipmentId] = (eqCountMap[item.equipmentId] || 0) + 1;
  });
  const equipmentIds = Object.keys(eqCountMap);
  const equipmentList = equipmentIds.length > 0
    ? await prisma.equipment.findMany({ where: { id: { in: equipmentIds } }, select: { id: true, name: true, status: true } })
    : [];
  const equipmentLoad = equipmentList
    .map((e) => ({ id: e.id, name: e.name, status: e.status, activeOrders: eqCountMap[e.id] || 0 }))
    .sort((a, b) => b.activeOrders - a.activeOrders);

  return {
    stats: {
      totalOrders,
      activeOrders,
      completedOrders,
      revenue: Number(revenue._sum.amount || 0),
      newOrdersWithoutAssignee,
    },
    recentOrders,
    topClients: topClientsProcessed,
    lowStock,
    operatorLoad,
    equipmentLoad,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const data = await getDashboardData();

  const statCards = [
    {
      label: "Активных заявок",
      value: data.stats.activeOrders,
      icon: <Clock size={18} />,
      color: "text-sky-600 bg-sky-50 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/20",
      href: "/orders?status=active",
    },
    {
      label: "Выручка за месяц",
      value: formatCurrency(data.stats.revenue),
      icon: <TrendingUp size={18} />,
      color: "text-emerald-600 bg-emerald-50 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
    },
    {
      label: "Завершено",
      value: data.stats.completedOrders,
      icon: <CheckCircle size={18} />,
      color: "text-accent bg-accent-soft ring-accent/15",
      href: "/orders?status=completed",
    },
    {
      label: "Без исполнителя",
      value: data.stats.newOrdersWithoutAssignee,
      icon: <AlertTriangle size={18} />,
      color: "text-amber-600 bg-amber-50 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
      href: "/orders?status=NEW",
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <PageHeader
        icon={<LayoutDashboard size={18} />}
        title={`Здравствуйте, ${session?.user.name || ""}`}
        subtitle="Сводка по производству на сегодня"
        actions={
          <Link
            href="/orders"
            className="inline-flex h-9.5 items-center gap-2 rounded-lg bg-accent px-4 text-[13px] font-medium text-white shadow-[0_1px_2px_rgb(16_20_28/0.16)] transition-colors hover:bg-accent-hover"
          >
            <Plus size={16} />
            Новая заявка
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const body = (
            <Card padding="md" interactive={!!card.href} className="h-full">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-fg-muted">{card.label}</p>
                  <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-tight text-fg tabular-nums">
                    {card.value}
                  </p>
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${card.color}`}>
                  {card.icon}
                </div>
              </div>
            </Card>
          );
          return card.href ? (
            <Link key={card.label} href={card.href} className="block">
              {body}
            </Link>
          ) : (
            <div key={card.label}>{body}</div>
          );
        })}
      </div>

      {/* Charts placeholder (client component) */}
      <DashboardCharts />

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft">
              <h2 className="font-semibold text-fg flex items-center gap-2">
                <ShoppingCart size={16} /> Последние заявки
              </h2>
              <Link href="/orders" className="text-xs text-accent hover:underline">
                Все заявки
              </Link>
            </div>
            <div className="divide-y divide-line-soft">
              {data.recentOrders.length === 0 ? (
                <p className="text-center text-sm text-fg-subtle py-8">Заявок пока нет</p>
              ) : (
                data.recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-surface-sunken dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-fg">{order.number}</span>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${ORDER_STATUS_COLORS[order.status]}`}
                        >
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${PRIORITY_COLORS[order.priority]}`}
                        >
                          {PRIORITY_LABELS[order.priority]}
                        </span>
                      </div>
                      <p className="text-xs text-fg-muted truncate mt-0.5">
                        {order.client.name} · {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-fg-muted ml-4 shrink-0">
                      {formatCurrency(Number(order.amount))}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Top clients */}
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
              <h2 className="font-semibold text-fg flex items-center gap-2">
                <Users size={16} /> Топ клиентов
              </h2>
            </div>
            <div className="divide-y divide-line-soft">
              {data.topClients.length === 0 ? (
                <p className="text-center text-sm text-fg-subtle py-6">Нет данных</p>
              ) : (
                data.topClients.map((client, idx) => (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-surface-sunken dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-fg-subtle">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fg truncate">{client.name}</p>
                      <p className="text-xs text-fg-subtle">{client.ordersCount} заказ(ов)</p>
                    </div>
                    <span className="text-xs font-semibold text-fg-muted">
                      {formatCurrency(client.totalAmount)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </Card>

          {/* Operator load */}
          {data.operatorLoad.length > 0 && (
            <Card padding="none">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-line-soft">
                <Users size={16} className="text-accent" />
                <h2 className="font-semibold text-fg">Загруженность</h2>
              </div>
              <div className="divide-y divide-line-soft">
                {data.operatorLoad.map((op) => (
                  <div key={op.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-7 h-7 bg-accent-soft rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-accent">{op.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fg truncate">{op.name}</p>
                      <div className="mt-1 h-1.5 bg-surface-hover rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${Math.min((op.activeTasks / 10) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-fg-muted ml-2 shrink-0">
                      {op.activeTasks} задач
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Equipment load */}
          {data.equipmentLoad.length > 0 && (
            <Card padding="none">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-line-soft">
                <Cpu size={16} className="text-blue-500" />
                <h2 className="font-semibold text-fg">Загруженность оборудования</h2>
              </div>
              <div className="divide-y divide-line-soft">
                {data.equipmentLoad.map((eq) => (
                  <div key={eq.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${eq.status === "MAINTENANCE" ? "bg-orange-400" : "bg-green-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fg truncate">{eq.name}</p>
                      <div className="mt-1 h-1.5 bg-surface-hover rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min((eq.activeOrders / 5) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-fg-muted ml-2 shrink-0">
                      {eq.activeOrders} зак.
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-line-soft">
                <a href="/settings/equipment" className="text-xs text-accent hover:underline">
                  Управление оборудованием →
                </a>
              </div>
            </Card>
          )}

          {/* Low stock alert */}
          {data.lowStock.length > 0 && (
            <Card padding="none">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-line-soft">
                <Package size={16} className="text-orange-500" />
                <h2 className="font-semibold text-fg">Заканчиваются расходники</h2>
              </div>
              <div className="divide-y divide-line-soft">
                {data.lowStock.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3">
                    <p className="text-sm text-fg-muted truncate flex-1">{item.name}</p>
                    <span className="text-xs text-orange-600 dark:text-orange-400 font-medium ml-2">
                      {item.stock} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-line-soft">
                <Link
                  href="/consumables"
                  className="text-xs text-accent hover:underline"
                >
                  Перейти к расходникам →
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
