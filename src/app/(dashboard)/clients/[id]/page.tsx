import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  CLIENT_TYPE_LABELS,
  CLIENT_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from "@/lib/constants";
import Card from "@/components/ui/Card";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  Building2,
  MapPin,
  CreditCard,
  ShoppingCart,
  FileText,
  Wallet,
} from "lucide-react";
import ClientEditButton from "./ClientEditButton";
import ClientPaymentButton from "./ClientPaymentButton";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true } } },
      },
      invoices: { orderBy: { date: "desc" }, take: 10 },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { order: { select: { number: true } } },
      },
    },
  });

  if (!client) notFound();

  const activeOrders = client.orders.filter((o) => o.status !== "CANCELLED");
  const totalAmount = activeOrders.reduce((sum, o) => sum + Number(o.amount), 0);
  const totalDebt = activeOrders.reduce(
    (sum, o) =>
      sum +
      (o.paymentStatus === "PAID"
        ? 0
        : Math.max(0, Number(o.amount) - Number(o.paidAmount))),
    0
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Back + Header */}
      <div>
        <Link
          href="/clients"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-fg-subtle transition-colors hover:text-fg"
        >
          <ArrowLeft size={14} /> Все клиенты
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-lg font-semibold text-accent-fg ring-1 ring-inset ring-accent/15">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-[22px]">{client.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="rounded-md bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-fg-muted ring-1 ring-inset ring-line">
                  {CLIENT_TYPE_LABELS[client.type]}
                </span>
                <span className="text-xs text-fg-subtle">
                  Клиент с {formatDate(client.createdAt)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ClientPaymentButton clientId={client.id} debt={totalDebt} />
            <ClientEditButton client={client} />
            <Link
              href={`/orders/new?clientId=${client.id}`}
              className="inline-flex h-9.5 items-center gap-2 rounded-lg bg-accent px-4 text-[13px] font-medium text-white shadow-[0_1px_2px_rgb(16_20_28/0.16)] transition-colors hover:bg-accent-hover"
            >
              <ShoppingCart size={15} /> Новая заявка
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <p className="text-xs text-fg-muted">Всего заказов</p>
          <p className="text-2xl font-bold text-fg mt-1">{client.orders.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-fg-muted">Общий оборот</p>
          <p className="text-2xl font-bold text-fg mt-1">{formatCurrency(totalAmount)}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-fg-muted">Задолженность</p>
          <p className={`text-2xl font-bold mt-1 ${totalDebt > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
            {formatCurrency(totalDebt)}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-fg-muted">Источник</p>
          <p className="text-lg font-semibold text-fg mt-1">
            {CLIENT_SOURCE_LABELS[client.source]}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact info */}
        <div className="space-y-4">
          <Card padding="md">
            <h2 className="font-semibold text-fg mb-3 flex items-center gap-2">
              <Phone size={16} /> Контакты
            </h2>
            <div className="space-y-2">
              {client.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-fg-subtle shrink-0" />
                  <a href={`tel:${client.phone}`} className="text-sm text-fg-muted hover:text-accent">
                    {client.phone}
                  </a>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-fg-subtle shrink-0" />
                  <a href={`mailto:${client.email}`} className="text-sm text-fg-muted hover:text-accent">
                    {client.email}
                  </a>
                </div>
              )}
              {client.telegram && (
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-fg-subtle shrink-0" />
                  <a href={`https://t.me/${client.telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="text-sm text-fg-muted hover:text-accent">
                    {client.telegram}
                  </a>
                </div>
              )}
              {client.whatsapp && (
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-green-500 shrink-0 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <a href={`https://wa.me/${client.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-sm text-fg-muted hover:text-green-600">
                    {client.whatsapp}
                  </a>
                </div>
              )}
              {!client.phone && !client.email && !client.telegram && !client.whatsapp && (
                <p className="text-sm text-fg-subtle">Контакты не указаны</p>
              )}
            </div>
          </Card>

          {(client.inn || client.kpp || client.ogrn) && (
            <Card padding="md">
              <h2 className="font-semibold text-fg mb-3 flex items-center gap-2">
                <Building2 size={16} /> Реквизиты
              </h2>
              <dl className="space-y-1.5">
                {client.inn && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-fg-muted">ИНН</dt>
                    <dd className="text-fg font-medium">{client.inn}</dd>
                  </div>
                )}
                {client.kpp && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-fg-muted">КПП</dt>
                    <dd className="text-fg font-medium">{client.kpp}</dd>
                  </div>
                )}
                {client.ogrn && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-fg-muted">ОГРН</dt>
                    <dd className="text-fg font-medium">{client.ogrn}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}

          {(client.legalAddress || client.postalAddress) && (
            <Card padding="md">
              <h2 className="font-semibold text-fg mb-3 flex items-center gap-2">
                <MapPin size={16} /> Адреса
              </h2>
              {client.legalAddress && (
                <div className="mb-2">
                  <p className="text-xs text-fg-muted mb-0.5">Юридический</p>
                  <p className="text-sm text-fg-muted">{client.legalAddress}</p>
                </div>
              )}
              {client.postalAddress && (
                <div>
                  <p className="text-xs text-fg-muted mb-0.5">Почтовый</p>
                  <p className="text-sm text-fg-muted">{client.postalAddress}</p>
                </div>
              )}
            </Card>
          )}

          {client.notes && (
            <Card padding="md">
              <h2 className="font-semibold text-fg mb-2">Заметки</h2>
              <p className="text-sm text-fg-muted whitespace-pre-line">{client.notes}</p>
            </Card>
          )}
        </div>

        {/* Orders */}
        <div className="lg:col-span-2 space-y-6">
          <Card padding="none">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft">
              <h2 className="font-semibold text-fg flex items-center gap-2">
                <ShoppingCart size={16} /> История заказов ({client.orders.length})
              </h2>
            </div>
            {client.orders.length === 0 ? (
              <div className="py-12 text-center text-fg-subtle">
                <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                Заказов пока нет
              </div>
            ) : (
              <div className="divide-y divide-line-soft">
                {client.orders.map((order) => {
                  const remaining =
                    order.paymentStatus === "PAID"
                      ? 0
                      : Math.max(0, Number(order.amount) - Number(order.paidAmount));
                  return (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-surface-sunken dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-fg">{order.number}</span>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${ORDER_STATUS_COLORS[order.status]}`}
                        >
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                        {order.status !== "CANCELLED" && (
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${PAYMENT_STATUS_COLORS[order.paymentStatus]}`}
                          >
                            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-fg-subtle mt-0.5">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-fg-muted">
                        {formatCurrency(Number(order.amount))}
                      </div>
                      {order.status !== "CANCELLED" && remaining > 0 && (
                        <div className="text-xs text-red-500 mt-0.5">остаток {formatCurrency(remaining)}</div>
                      )}
                    </div>
                  </Link>
                  );
                })}
              </div>
            )}
          </Card>

          <Card padding="none">
            <div className="px-6 py-4 border-b border-line-soft">
              <h2 className="font-semibold text-fg flex items-center gap-2">
                <Wallet size={16} /> Журнал оплат ({client.payments.length})
              </h2>
            </div>
            {client.payments.length === 0 ? (
              <div className="py-10 text-center text-fg-subtle">
                <Wallet size={28} className="mx-auto mb-2 opacity-30" />
                Оплат пока не было
              </div>
            ) : (
              <div className="divide-y divide-line-soft">
                {client.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-6 py-2.5">
                    <div>
                      <p className="text-sm text-fg-muted">
                        {p.order ? `Заявка ${p.order.number}` : "Оплата"}
                      </p>
                      <p className="text-xs text-fg-subtle mt-0.5">
                        {formatDate(p.createdAt)}{p.userName ? ` · ${p.userName}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                      +{formatCurrency(Number(p.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
