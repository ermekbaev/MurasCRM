-- Дата выдачи заявки. По ней канбан показывает в колонке «Выдано» только свежие,
-- а старые уходят в архив (список «Завершённые»). Для уже выданных берём дату
-- последнего изменения: точнее у нас ничего нет.
ALTER TABLE "Order" ADD COLUMN "issuedAt" TIMESTAMP(3);
UPDATE "Order" SET "issuedAt" = "updatedAt" WHERE "status" = 'ISSUED';
