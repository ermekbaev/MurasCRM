import { prisma } from "@/lib/prisma";
import { generateDownloadUrl } from "@/lib/s3";
import { notFound } from "next/navigation";
import InvoicePrintView from "./InvoicePrintView";

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

  // Логотип, печать и подпись лежат в хранилище — в документ нужны ссылки.
  // Раньше они сюда не передавались вовсе, поэтому счёт печатался без них.
  const [logoUrl, stampUrl, signatureUrl] = await Promise.all([
    settings?.logoKey ? generateDownloadUrl(settings.logoKey).catch(() => null) : null,
    settings?.stampKey ? generateDownloadUrl(settings.stampKey).catch(() => null) : null,
    settings?.signatureKey ? generateDownloadUrl(settings.signatureKey).catch(() => null) : null,
  ]);

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
    />
  );
}
