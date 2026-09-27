-- Публичная ссылка статуса заказа для клиента.
--
-- По этому токену открывается страница /track без входа — клиент видит только
-- статус своей заявки, без сумм и чужих данных. Пусто, пока менеджер ссылку
-- не создал.
ALTER TABLE "Order" ADD COLUMN "publicToken" TEXT;
CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");
