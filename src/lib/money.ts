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
  totals: { income: number; expense: number; balance: number; profit: number };
}
