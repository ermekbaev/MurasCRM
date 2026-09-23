import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { MONEY_READ_ROLES } from "@/lib/money-roles";
import { periodRange } from "@/lib/money-period";

/** Сумма по ключу счёта; null — движение без указанного счёта. */
type ByAccount = Map<string | null, number>;

function toMap(rows: { accountId: string | null; _sum: { amount: unknown } }[]): ByAccount {
  return new Map(rows.map((r) => [r.accountId, Number(r._sum.amount ?? 0)]));
}

/**
 * Отчёт по счетам: сколько пришло и ушло по каждой карте и кассе.
 *
 * Обороты считаются за период, остаток — за всё время: остаток на карте не
 * зависит от того, какой месяц сейчас выбран на экране.
 */
export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!MONEY_READ_ROLES.includes(session.user.role)) return apiError.forbidden();

  const url = new URL(req.url);
  const { from, to } = periodRange(url.searchParams);
  const period = { date: { gte: from, lte: to } };

  const [accounts, incomePeriod, expensePeriod, incomeAll, expenseAll, byCategory, categories] =
    await Promise.all([
      prisma.moneyAccount.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
      prisma.payment.groupBy({ by: ["accountId"], where: period, _sum: { amount: true } }),
      prisma.expense.groupBy({ by: ["accountId"], where: period, _sum: { amount: true } }),
      prisma.payment.groupBy({ by: ["accountId"], _sum: { amount: true } }),
      prisma.expense.groupBy({ by: ["accountId"], _sum: { amount: true } }),
      prisma.expense.groupBy({ by: ["categoryId"], where: period, _sum: { amount: true } }),
      prisma.expenseCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    ]);

  const inP = toMap(incomePeriod);
  const exP = toMap(expensePeriod);
  const inA = toMap(incomeAll);
  const exA = toMap(expenseAll);

  const round = (n: number) => Math.round(n * 100) / 100;

  const rows = accounts.map((a) => {
    const start = Number(a.startBalance);
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      isActive: a.isActive,
      startBalance: start,
      income: round(inP.get(a.id) ?? 0),
      expense: round(exP.get(a.id) ?? 0),
      balance: round(start + (inA.get(a.id) ?? 0) - (exA.get(a.id) ?? 0)),
    };
  });

  // Движения, у которых счёт не указан, нельзя просто потерять: иначе итог
  // отчёта не сойдётся с суммой прихода и расхода в списках.
  const unassigned = {
    income: round(inP.get(null) ?? 0),
    expense: round(exP.get(null) ?? 0),
  };

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const expensesByCategory = byCategory
    .map((c) => ({
      id: c.categoryId,
      name: c.categoryId ? categoryNames.get(c.categoryId) ?? "Удалённая статья" : "Без статьи",
      amount: round(Number(c._sum.amount ?? 0)),
    }))
    .sort((a, b) => b.amount - a.amount);

  const totals = {
    income: round(rows.reduce((s, r) => s + r.income, 0) + unassigned.income),
    expense: round(rows.reduce((s, r) => s + r.expense, 0) + unassigned.expense),
    balance: round(rows.reduce((s, r) => s + r.balance, 0)),
  };

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    accounts: rows,
    unassigned,
    expensesByCategory,
    totals: { ...totals, profit: round(totals.income - totals.expense) },
  });
}
