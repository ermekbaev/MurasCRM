-- Работа с НДС на уровне компании.
-- Выключено по умолчанию: у большинства мелких студий печати УСН без НДС,
-- и лишние поля в счёте им только мешают. Ставка 20 — на случай включения.
ALTER TABLE "CompanySettings" ADD COLUMN "worksWithVat" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CompanySettings" ADD COLUMN "defaultVatRate" DECIMAL(5,2) NOT NULL DEFAULT 20;

-- Кто уже выставлял счета с НДС — тому включаем, чтобы настройка не сбросила
-- сложившуюся практику.
UPDATE "CompanySettings" SET "worksWithVat" = true
WHERE EXISTS (SELECT 1 FROM "Invoice" WHERE "vatRate" > 0);
