-- Код по ОКПО: обязательная графа в шапке ТОРГ-12 у поставщика,
-- грузоотправителя, грузополучателя и плательщика.
ALTER TABLE "CompanySettings" ADD COLUMN "okpo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Client" ADD COLUMN "okpo" TEXT;
