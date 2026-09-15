import { legalName } from "@/lib/utils";

/**
 * Строки реквизитов сторон накладной.
 *
 * Одна и та же строка печатается во встроенной ТОРГ-12 и подставляется в
 * загруженный Word-бланк. Держим сборку в одном месте: иначе при первой же
 * правке формат в бланке и в форме разойдётся — ровно так уже разъезжались
 * экранная форма счёта и его PDF.
 */

export interface PartyRequisites {
  name: string;
  fullName?: string | null;
  inn?: string | null;
  kpp?: string | null;
  legalAddress?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  corrAccount?: string | null;
  bankBik?: string | null;
  phone?: string | null;
}

/** Грузоотправитель и поставщик — наша компания: название, адрес, ИНН, банк, телефон. */
export function companyRequisitesLine(company: PartyRequisites | null | undefined): string {
  if (!company) return "";
  return [
    company.name,
    company.legalAddress,
    company.inn ? `ИНН ${company.inn}` : "",
    company.bankAccount ? `р/с ${company.bankAccount}` : "",
    company.bankName ? `банк ${company.bankName}` : "",
    company.corrAccount ? `к/с ${company.corrAccount}` : "",
    company.bankBik ? `БИК ${company.bankBik}` : "",
    company.phone ? `тел.: ${company.phone}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/** Грузополучатель и плательщик — контрагент, полным наименованием. */
export function partyRequisitesLine(party: PartyRequisites | null | undefined): string {
  if (!party) return "";
  return [
    legalName(party),
    party.legalAddress,
    party.inn ? `ИНН ${party.inn}` : "",
    party.bankAccount ? `р/с ${party.bankAccount}` : "",
    party.bankName ? `банк ${party.bankName}` : "",
    party.corrAccount ? `к/с ${party.corrAccount}` : "",
    party.bankBik ? `БИК ${party.bankBik}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}
