/** Общие типы и подписи для раздела денег — используются страницами и формами. */

export type MoneyAccountKind = "CASH" | "CARD" | "BANK";

export const ACCOUNT_KIND_LABELS: Record<MoneyAccountKind, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  BANK: "Расчётный счёт",
};

/**
 * Подпись типа рядом с названием счёта — или ничего.
 *
 * Счёт чаще всего так и называют: «Наличные». Повторять тип следом («Наличные
 * Наличные») незачем — подпись нужна там, где из названия тип не ясен.
 */
export function accountKindHint(name: string, kind: MoneyAccountKind): string | null {
  const label = ACCOUNT_KIND_LABELS[kind];
  return name.trim().toLowerCase() === label.toLowerCase() ? null : label;
}

export interface MoneyAccount {
  id: string;
  name: string;
  kind: MoneyAccountKind;
  startBalance: number;
  sortOrder: number;
  isActive: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MoneyRow {
  id: string;
  date: string;
  amount: number;
  comment: string;
  userName: string | null;
  account: { id: string; name: string } | null;
}

export interface PaymentRow extends MoneyRow {
  client: { id: string; name: string } | null;
  order: { id: string; number: string } | null;
}

export interface ExpenseRow extends MoneyRow {
  category: { id: string; name: string } | null;
  order: { id: string; number: string } | null;
  supplier: { id: string; name: string } | null;
}

export interface MoneyReport {
  from: string;
  to: string;
  accounts: {
    id: string;
    name: string;
    kind: MoneyAccountKind;
    isActive: boolean;
    startBalance: number;
    income: number;
    expense: number;
    balance: number;
  }[];
  unassigned: { income: number; expense: number };
  expensesByCategory: { id: string | null; name: string; amount: number }[];
  totals: {
    income: number;
    expense: number;
    balance: number;
    profit: number;
    /** Число приходов и расходов за период. */
    incomeCount: number;
    expenseCount: number;
  };
}

/**
 * Русское склонение по числу: 1 перевод, 2 перевода, 5 переводов.
 * forms = [один, два-четыре, пять и «дцать»].
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (d > 1 && d < 5) return forms[1];
  if (d === 1) return forms[0];
  return forms[2];
}
