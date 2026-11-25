import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import InvoicePrintView from "./InvoicePrintView";
import InvoiceClosingDocs from "./InvoiceClosingDocs";
import InvoiceDocumentMenu from "./InvoiceDocumentMenu";
import { defaultInvoiceTemplate } from "@/lib/fillTemplate.server";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [invoice, settings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        order: { select: { id: true, number: true } },
        items: true,
        // закрывающие документы по счёту — блок «Документы по счёту» (DASS 26.11)
        waybills: { select: { id: true, number: true, date: true }, orderBy: { date: "asc" } },
        acts: { select: { id: true, number: true, date: true }, orderBy: { date: "asc" } },
      },
    }),
    prisma.companySettings.findFirst(),
  ]);

  if (!invoice) notFound();

  // Источник реквизитов: выбранная доп.компания, иначе основная (CompanySettings)
  const chosenCompany = invoice.companyId
    ? await prisma.company.findUnique({ where: { id: invoice.companyId } })
    : null;
  const company = chosenCompany ?? settings;

  // Логотип, печать и подпись отдаёт наш сервер, а не хранилище напрямую.
  // С подписанной ссылкой они показывались на экране, но пропадали в PDF:
  // снимок страницы не может прочитать картинку с чужого домена.
  const logoUrl = settings?.logoKey ? "/api/settings/branding?kind=logo" : null;
  const stampUrl = settings?.stampKey ? "/api/settings/branding?kind=stamp" : null;
  const signatureUrl = settings?.signatureKey ? "/api/settings/branding?kind=signature" : null;

  return (
    <InvoicePrintView
      invoice={{
        ...invoice,
        subtotal: Number(invoice.subtotal),
        vatAmount: Number(invoice.vatAmount),
        total: Number(invoice.total),
        date: invoice.date.toISOString(),
        dueDate: invoice.dueDate?.toISOString() || null,
        vatRate: Number(invoice.vatRate),
        items: invoice.items.map((i) => ({
          ...i,
          qty: Number(i.qty),
          price: Number(i.price),
          total: Number(i.total),
        })),
      }}
      company={company}
      logoUrl={logoUrl}
      stampUrl={stampUrl}
      signatureUrl={signatureUrl}
      templateName={(await defaultInvoiceTemplate())?.name ?? null}
      documentMenu={
        <InvoiceDocumentMenu
          invoiceId={invoice.id}
          invoiceNumber={invoice.number}
          clientId={invoice.clientId}
          orderId={invoice.order?.id ?? null}
          items={invoice.items.map((i) => ({ name: i.name, qty: Number(i.qty), unit: i.unit, price: Number(i.price) }))}
          waybills={invoice.waybills.map((w) => ({ id: w.id, number: w.number }))}
          acts={invoice.acts.map((a) => ({ id: a.id, number: a.number }))}
        />
      }
      closingDocs={
        <InvoiceClosingDocs
          invoiceId={invoice.id}
          orderId={invoice.order?.id ?? null}
          items={invoice.items.map((i) => ({ name: i.name, qty: Number(i.qty), unit: i.unit, price: Number(i.price) }))}
          waybills={invoice.waybills.map((w) => ({ ...w, date: w.date.toISOString() }))}
          acts={invoice.acts.map((a) => ({ ...a, date: a.date.toISOString() }))}
        />
      }
    />
  );
}
