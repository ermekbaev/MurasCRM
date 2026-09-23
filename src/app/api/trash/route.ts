import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prismaRaw } from "@/lib/prisma";
import { z } from "zod";

/**
 * Корзина: что удалили, вернуть и вычистить.
 *
 * Ходит мимо общего фильтра (prismaRaw) — обычный клиент удалённое не видит,
 * в том и смысл.
 *
 * Доступ только у администратора. Удалять могут разные роли, но возврат — это
 * восстановление данных: пусть его делает один человек, а не тот же, кто
 * случайно удалил.
 */
const TRASH_ROLES = ["ADMIN"];

/** Сколько дней запись лежит в корзине, прежде чем её вычистит крон. */
export const TRASH_KEEP_DAYS = 30;

const TYPES = ["order", "client", "invoice", "act", "waybill", "expense"] as const;
type TrashType = (typeof TYPES)[number];

const LABELS: Record<TrashType, string> = {
  order: "Заявка",
  client: "Клиент",
  invoice: "Счёт",
  act: "Акт",
  waybill: "Накладная",
  expense: "Расход",
};

const actionSchema = z.object({
  type: z.enum(TYPES),
  id: z.string().min(1),
  action: z.enum(["restore", "purge"]),
});

export interface TrashItem {
  type: TrashType;
  typeLabel: string;
  id: string;
  title: string;
  subtitle: string;
  deletedAt: string;
  deletedBy: string;
}

export async function GET() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!TRASH_ROLES.includes(session.user.role)) return apiError.forbidden();

  const deleted = { deletedAt: { not: null } };
  const order = { deletedAt: "desc" } as const;

  const [orders, clients, invoices, acts, waybills, expenses, users] = await Promise.all([
    prismaRaw.order.findMany({
      where: deleted,
      orderBy: order,
      select: { id: true, number: true, title: true, deletedAt: true, deletedById: true, client: { select: { name: true } } },
    }),
    prismaRaw.client.findMany({
      where: deleted,
      orderBy: order,
      select: { id: true, name: true, phone: true, deletedAt: true, deletedById: true },
    }),
    prismaRaw.invoice.findMany({
      where: deleted,
      orderBy: order,
      select: { id: true, number: true, total: true, deletedAt: true, deletedById: true, client: { select: { name: true } } },
    }),
    prismaRaw.act.findMany({
      where: deleted,
      orderBy: order,
      select: { id: true, number: true, total: true, deletedAt: true, deletedById: true },
    }),
    prismaRaw.waybill.findMany({
      where: deleted,
      orderBy: order,
      select: { id: true, number: true, total: true, deletedAt: true, deletedById: true, client: { select: { name: true } } },
    }),
    prismaRaw.expense.findMany({
      where: deleted,
      orderBy: order,
      select: {
        id: true,
        amount: true,
        date: true,
        comment: true,
        deletedAt: true,
        deletedById: true,
        category: { select: { name: true } },
        account: { select: { name: true } },
      },
    }),
    prismaRaw.user.findMany({ select: { id: true, name: true } }),
  ]);

  const names = new Map(users.map((u) => [u.id, u.name]));
  const who = (id: string | null) => (id ? names.get(id) ?? "—" : "—");
  const money = (v: unknown) =>
    Number(v).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";

  const items: TrashItem[] = [
    ...orders.map((o) => ({
      type: "order" as const,
      typeLabel: LABELS.order,
      id: o.id,
      title: o.number,
      subtitle: [o.title, o.client?.name].filter(Boolean).join(" · "),
      deletedAt: o.deletedAt!.toISOString(),
      deletedBy: who(o.deletedById),
    })),
    ...clients.map((c) => ({
      type: "client" as const,
      typeLabel: LABELS.client,
      id: c.id,
      title: c.name,
      subtitle: c.phone ?? "",
      deletedAt: c.deletedAt!.toISOString(),
      deletedBy: who(c.deletedById),
    })),
    ...invoices.map((i) => ({
      type: "invoice" as const,
      typeLabel: LABELS.invoice,
      id: i.id,
      title: i.number,
      subtitle: [i.client?.name, money(i.total)].filter(Boolean).join(" · "),
      deletedAt: i.deletedAt!.toISOString(),
      deletedBy: who(i.deletedById),
    })),
    ...acts.map((a) => ({
      type: "act" as const,
      typeLabel: LABELS.act,
      id: a.id,
      title: a.number,
      subtitle: money(a.total),
      deletedAt: a.deletedAt!.toISOString(),
      deletedBy: who(a.deletedById),
    })),
    ...waybills.map((w) => ({
      type: "waybill" as const,
      typeLabel: LABELS.waybill,
      id: w.id,
      title: w.number,
      subtitle: [w.client?.name, money(w.total)].filter(Boolean).join(" · "),
      deletedAt: w.deletedAt!.toISOString(),
      deletedBy: who(w.deletedById),
    })),
    ...expenses.map((e) => ({
      type: "expense" as const,
      typeLabel: LABELS.expense,
      id: e.id,
      title: [e.category?.name ?? "Без статьи", money(e.amount)].join(" · "),
      subtitle: [e.date.toLocaleDateString("ru-RU"), e.account?.name, e.comment]
        .filter(Boolean)
        .join(" · "),
      deletedAt: e.deletedAt!.toISOString(),
      deletedBy: who(e.deletedById),
    })),
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

  return NextResponse.json({ items, keepDays: TRASH_KEEP_DAYS });
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!TRASH_ROLES.includes(session.user.role)) return apiError.forbidden();

  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());
  const { type, id, action } = parsed.data;

  // Модель выбирается из закрытого списка выше, произвольное имя сюда не попадёт.
  const model = prismaRaw[type] as {
    update: (a: unknown) => Promise<unknown>;
    delete: (a: unknown) => Promise<unknown>;
  };

  try {
    if (action === "restore") {
      await model.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
      return NextResponse.json({ ok: true });
    }

    // Насовсем: тут запись и всё привязанное к ней исчезает по-настоящему.
    await model.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return apiError.notFound();
  }
}
