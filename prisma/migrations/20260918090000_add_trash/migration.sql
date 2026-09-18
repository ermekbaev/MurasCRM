-- Корзина. Удаление перестаёт стирать запись: она помечается и пропадает из
-- списков, но её можно вернуть. Раньше удаление было физическим и вместе с
-- заявкой уносило её позиции, файлы, комментарии и журнал изменений —
-- восстановить это было нельзя ничем, кроме резервной копии базы.
ALTER TABLE "Order"   ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Client"  ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Act"     ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Waybill" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;

CREATE INDEX "Order_deletedAt_idx"   ON "Order"("deletedAt");
CREATE INDEX "Client_deletedAt_idx"  ON "Client"("deletedAt");
CREATE INDEX "Invoice_deletedAt_idx" ON "Invoice"("deletedAt");
CREATE INDEX "Act_deletedAt_idx"     ON "Act"("deletedAt");
CREATE INDEX "Waybill_deletedAt_idx" ON "Waybill"("deletedAt");
