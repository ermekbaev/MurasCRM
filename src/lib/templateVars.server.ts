// Только для серверных модулей: тянет prisma.
import { prisma } from "@/lib/prisma";
import type { DocumentVarKey } from "@/lib/documentVars";

const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: "Новая", IN_PROGRESS: "В работе", REVIEW: "На проверке",
  READY: "Готово", ISSUED: "Выдано", CANCELLED: "Отменено",
};
const PAYMENT_LABELS: Record<string, string> = {
  UNPAID: "Не оплачен", ADVANCE: "Аванс", PAID: "Оплачен",
};

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ru-RU");
}

export interface TemplateContext {
  orderId?: string;
  invoiceId?: string;
  clientId?: string;
}

/** Позиция для построчного цикла в DOCX-шаблоне. */
export interface TemplateRow {
  n: number;
  name: string;
  qty: string;
  unit: string;
  price: string;
  total: string;
}

/**
 * Собирает значения переменных шаблона из заявки, счёта и настроек компании.
 * Общая для текстовых шаблонов и DOCX-бланков — иначе наборы разъехались бы.
 */
export async function buildTemplateVars({ orderId, invoiceId, clientId }: TemplateContext) {
  // Ключи ограничены справочником @/lib/documentVars — если добавить сюда
  // переменную, которой там нет, сборка упадёт, и подсказка в интерфейсе
  // не разойдётся с реальным набором.
  const vars: Partial<Record<DocumentVarKey, string>> = {
    date: fmtDate(new Date()),
  };

  // Company settings
  const company = await prisma.companySettings.findFirst();
  if (company) {
    vars.company_name   = company.name ?? "";
    vars.company_inn    = company.inn ?? "";
    vars.company_kpp    = company.kpp ?? "";
    vars.company_ogrn   = company.ogrn ?? "";
    vars.company_address = company.legalAddress ?? "";
    vars.company_phone  = company.phone ?? "";
    vars.director       = company.director ?? "";
    vars.accountant     = company.accountant ?? "";
    vars.bank_name      = company.bankName ?? "";
    vars.bank_account   = company.bankAccount ?? "";
    vars.bank_bik       = company.bankBik ?? "";
    vars.corr_account   = company.corrAccount ?? "";
  }

  // Order context
  if (orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: true,
        manager: { select: { name: true } },
        items: { include: { equipment: { select: { name: true } } } },
      },
    });
    if (order) {
      vars.order_number   = order.number;
      vars.order_type     = [...new Set(order.items.map((i) => i.equipment?.name ?? i.name))].join(", ");
      vars.order_status   = ORDER_STATUS_LABELS[order.status] ?? order.status;
      vars.order_deadline = fmtDate(order.deadline);
      vars.order_amount   = fmt(Number(order.amount));
      vars.payment_status = PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus;
      vars.manager_name   = order.manager?.name ?? "";
      vars.total          = fmt(Number(order.amount));
      // Client from order
      if (order.client) {
        vars.client_name      = order.client.name;
        vars.client_full_name = order.client.fullName || order.client.name;
        vars.client_inn     = order.client.inn ?? "";
        vars.client_kpp     = order.client.kpp ?? "";
        vars.client_ogrn    = order.client.ogrn ?? "";
        vars.client_address = order.client.legalAddress ?? "";
        vars.client_phone   = order.client.phone ?? "";
        vars.client_email   = order.client.email ?? "";
      }
      // Items list
      if (order.items.length > 0) {
        vars.order_items = order.items
          .map((item, i) => `${i + 1}. ${item.name} — ${Number(item.qty)} ${item.unit} × ${fmt(Number(item.price))} = ${fmt(Number(item.total))} руб.`)
          .join("\n");
      }
    }
  }

  // Invoice context
  if (invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true, items: true },
    });
    if (invoice) {
      vars.invoice_number  = invoice.number;
      vars.invoice_date    = fmtDate(invoice.date);
      vars.invoice_due_date = fmtDate(invoice.dueDate);
      vars.invoice_basis   = invoice.basis ?? "";
      vars.subtotal        = fmt(Number(invoice.subtotal));
      vars.vat             = fmt(Number(invoice.vatAmount));
      vars.vat_rate        = String(Number(invoice.vatRate));
      vars.total           = fmt(Number(invoice.total));
      if (invoice.client) {
        vars.client_name      = vars.client_name || invoice.client.name;
        vars.client_full_name = vars.client_full_name || invoice.client.fullName || invoice.client.name;
        vars.client_inn     = vars.client_inn || (invoice.client.inn ?? "");
        vars.client_kpp     = vars.client_kpp || (invoice.client.kpp ?? "");
        vars.client_address = vars.client_address || (invoice.client.legalAddress ?? "");
      }
    }
  }

  // Standalone client context
  if (clientId && !vars.client_name) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (client) {
      vars.client_name      = client.name;
      vars.client_full_name = client.fullName || client.name;
      vars.client_inn     = client.inn ?? "";
      vars.client_kpp     = client.kpp ?? "";
      vars.client_ogrn    = client.ogrn ?? "";
      vars.client_address = client.legalAddress ?? "";
      vars.client_phone   = client.phone ?? "";
      vars.client_email   = client.email ?? "";
    }
  }


  return vars;
}

/** Те же позиции, но структурой — для цикла по строкам таблицы в DOCX. */
export async function buildTemplateRows({ orderId, invoiceId }: TemplateContext): Promise<TemplateRow[]> {
  if (invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
    if (invoice) {
      return invoice.items.map((i, idx) => ({
        n: idx + 1,
        name: i.name,
        qty: String(Number(i.qty)),
        unit: i.unit,
        price: fmt(Number(i.price)),
        total: fmt(Number(i.total)),
      }));
    }
  }
  if (orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (order) {
      return order.items.map((i, idx) => ({
        n: idx + 1,
        name: i.name,
        qty: String(Number(i.qty)),
        unit: i.unit,
        price: fmt(Number(i.price)),
        total: fmt(Number(i.total)),
      }));
    }
  }
  return [];
}
