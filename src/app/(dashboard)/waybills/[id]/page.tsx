import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import WaybillPrintView from "./WaybillPrintView";

export default async function WaybillDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ form?: string }>;
}) {
  const { id } = await params;
  // форма из адреса (меню «Документ» счёта, печать в PDF) читается на сервере — иначе сервер рисовал ТОРГ-12,
  // а браузер УПД, и страница ловила ошибку гидратации (26.11)
  const asked = (await searchParams).form;

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

  // вид документа (УПД / ТОРГ-12) задан при создании — открываем его; у старых без вида решает адрес, как раньше
  const initialForm =
    waybill.form === "UPD" ? "upd" : waybill.form === "TORG12" ? "torg12" : asked === "upd" || asked === "simple" ? asked : "torg12";

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
      logoUrl={settings?.logoKey ? "/api/settings/branding?kind=logo" : null}
      initialForm={initialForm}
    />
  );
}
