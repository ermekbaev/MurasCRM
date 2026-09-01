import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import WaybillPrintView from "./WaybillPrintView";

export default async function WaybillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [waybill, settings] = await Promise.all([
    prisma.waybill.findUnique({
      where: { id },
      include: {
        items: true,
        client: true,
        payer: true,
        consignee: true,
        invoice: { select: { id: true, number: true, date: true } },
        order: { select: { id: true, number: true } },
      },
    }),
    prisma.companySettings.findFirst(),
  ]);

  if (!waybill) notFound();

  // Источник реквизитов: выбранная доп.компания, иначе основная (CompanySettings)
  const chosenCompany = waybill.companyId
    ? await prisma.company.findUnique({ where: { id: waybill.companyId } })
    : null;
  // Доп. компании не хранят настройку НДС и ОКПО — берём их из основной,
  // а Decimal приводим к числу: в клиентский компонент он уехал бы строкой.
  const source = chosenCompany ?? settings;
  const company = source
    ? {
        ...source,
        okpo: settings?.okpo ?? "",
        worksWithVat: Boolean(settings?.worksWithVat),
        defaultVatRate: Number(settings?.defaultVatRate ?? 0),
      }
    : null;

  return (
    <WaybillPrintView
      waybill={{
        ...waybill,
        total: Number(waybill.total),
        date: waybill.date.toISOString(),
        invoice: waybill.invoice
          ? { ...waybill.invoice, date: waybill.invoice.date.toISOString() }
          : null,
        items: waybill.items.map((i) => ({
          ...i,
          qty: Number(i.qty),
          price: Number(i.price),
          total: Number(i.total),
        })),
      }}
      company={company}
    />
  );
}
