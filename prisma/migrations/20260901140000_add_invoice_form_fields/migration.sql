-- Поля для классической формы счёта на оплату.
-- invoiceNotice — предупреждение об условиях оплаты в шапке; текст у каждой
-- компании свой, поэтому он редактируемый, а не зашит в вёрстку.
ALTER TABLE "CompanySettings" ADD COLUMN "directorTitle" TEXT NOT NULL DEFAULT 'Генеральный директор';
ALTER TABLE "CompanySettings" ADD COLUMN "invoiceNotice" TEXT NOT NULL DEFAULT '';

UPDATE "CompanySettings" SET "invoiceNotice" =
  'Внимание! Оплата данного счета означает согласие с условиями поставки товара. Уведомление об оплате обязательно, в противном случае не гарантируется наличие товара на складе. Товар отпускается по факту прихода денег на р/с Поставщика, самовывозом, при наличии доверенности и паспорта.'
WHERE "invoiceNotice" = '';
