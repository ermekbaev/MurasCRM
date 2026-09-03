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
  const buyerSource = waybill.payer ?? waybill.client;

  // Проверяем всё разом и перечисляем, чего не хватает. По одному полю за раз
  // человек чинит вслепую: заполнил ИНН, снова нажал, узнал про КПП, и так по
  // кругу. Пустые места молча прочерками не заполняем: документ получился бы
  // формально правильным и при этом бессмысленным — подписант без фамилии.
  const missing: string[] = [];

  if (!settings?.name) missing.push("название компании");
  if (!settings?.inn) missing.push("ИНН компании");
  // КПП есть только у организаций: у предпринимателя его не бывает.
  if (settings?.inn && settings.inn.replace(/\D/g, "").length === 10 && !settings.kpp) {
    missing.push("КПП компании");
  }
  if (!settings?.legalAddress) missing.push("юридический адрес компании");
  if (!settings?.director) missing.push("ФИО руководителя — им подписывается документ");

  if (!settings || missing.length > 0) {
    return apiError.badRequest(
      `Не заполнено в разделе Настройки → Компания: ${missing.join(", ")}. ` +
        "ЭДО отклонит документ без этих сведений.",
    );
  }

  const buyerMissing: string[] = [];
  if (!buyerSource.inn) buyerMissing.push("ИНН");
  if (
    buyerSource.inn &&
    buyerSource.inn.replace(/\D/g, "").length === 10 &&
    !buyerSource.kpp
  ) {
    buyerMissing.push("КПП");
  }
  if (!buyerSource.legalAddress) buyerMissing.push("юридический адрес");

  if (buyerMissing.length > 0) {
    return apiError.badRequest(
      `У контрагента «${buyerSource.name}» не заполнено: ${buyerMissing.join(", ")}. ` +
        "Без этих сведений ЭДО отклонит документ.",
    );
  }

  const toParty = (c: {
    name: string;
    fullName?: string | null;
    inn: string | null;
    kpp: string | null;
    okpo?: string | null;
    ogrn?: string | null;
    legalAddress: string | null;
  }): UpdParty => ({
    name: legalName(c),
    inn: c.inn ?? "",
    kpp: c.kpp ?? "",
    okpo: c.okpo ?? undefined,
    ogrn: c.ogrn ?? undefined,
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
      okpo: settings.okpo || undefined,
      ogrn: settings.ogrn || undefined,
      address: settings.legalAddress,
      bankName: settings.bankName || undefined,
      bankAccount: settings.bankAccount || undefined,
      bankBik: settings.bankBik || undefined,
      corrAccount: settings.corrAccount || undefined,
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
