import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildUpdXml, type UpdParty } from "@/lib/upd-xml";
import { legalName } from "@/lib/utils";

/** Выгрузка документа — то же право, что и на формирование документов. */
const DOCUMENT_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT"];

/**
 * УПД в XML формата ФНС для ручной загрузки в ЭДО.
 *
 * Отдаём файл, а не отправляем сами: подписывает бухгалтер своей КЭП в личном
 * кабинете оператора. Ключ подписи лежит на токене и наружу не выдаётся.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!DOCUMENT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const waybill = await prisma.waybill.findUnique({
    where: { id },
    include: {
      items: true,
      client: true,
      payer: true,
      consignee: true,
      invoice: { select: { number: true, vatRate: true } },
    },
  });
  if (!waybill) return apiError.notFound();

  const settings = await prisma.companySettings.findFirst();
  if (!settings?.inn) {
    return apiError.badRequest(
      "Не заполнены реквизиты компании. ЭДО не примет документ без ИНН — " +
        "заполните их в разделе Настройки → Компания.",
    );
  }

  const buyerSource = waybill.payer ?? waybill.client;
  if (!buyerSource.inn) {
    return apiError.badRequest(
      `У контрагента «${buyerSource.name}» не указан ИНН. ` +
        "Без него ЭДО отклонит документ.",
    );
  }

  const toParty = (c: {
    name: string;
    fullName?: string | null;
    inn: string | null;
    kpp: string | null;
    legalAddress: string | null;
  }): UpdParty => ({
    name: legalName(c),
    inn: c.inn ?? "",
    kpp: c.kpp ?? "",
    address: c.legalAddress ?? "",
  });

  const vatRate = Number(waybill.invoice?.vatRate ?? settings.defaultVatRate ?? 0);

  const { fileName, buffer } = buildUpdXml({
    number: waybill.number,
    date: waybill.date,
    basis: waybill.basis ?? (waybill.invoice ? `Счёт № ${waybill.invoice.number}` : ""),
    seller: {
      name: settings.name,
      inn: settings.inn,
      kpp: settings.kpp,
      address: settings.legalAddress,
    },
    buyer: toParty(buyerSource),
    consignee: waybill.consignee ? toParty(waybill.consignee) : null,
    items: waybill.items.map((i) => ({
      name: i.name,
      qty: Number(i.qty),
      unit: i.unit,
      price: Number(i.price),
      total: Number(i.total),
    })),
    worksWithVat: settings.worksWithVat,
    vatRate,
    signerName: settings.director,
    signerTitle: settings.directorTitle,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/xml; charset=windows-1251",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
