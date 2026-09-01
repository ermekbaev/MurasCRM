-- Настраиваемые префиксы номеров документов.
-- Значения по умолчанию совпадают с прежними захардкоженными, поэтому
-- нумерация у существующих инстансов не меняется.
ALTER TABLE "CompanySettings" ADD COLUMN "orderPrefix"   TEXT NOT NULL DEFAULT 'ЗАК';
ALTER TABLE "CompanySettings" ADD COLUMN "invoicePrefix" TEXT NOT NULL DEFAULT 'СЧ';
ALTER TABLE "CompanySettings" ADD COLUMN "actPrefix"     TEXT NOT NULL DEFAULT 'АКТ';
ALTER TABLE "CompanySettings" ADD COLUMN "waybillPrefix" TEXT NOT NULL DEFAULT 'НАКЛ';
