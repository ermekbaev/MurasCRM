-- Товарная накладная (ТОРГ-12). Формируется на основании счёта:
-- позиции и реквизиты подтягиваются из него, но плательщик и грузополучатель
-- могут отличаться от контрагента счёта (филиальные клиенты).
CREATE TABLE "Waybill" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "invoiceId" TEXT,
    "orderId" TEXT,
    "companyId" TEXT,
    "clientId" TEXT NOT NULL,
    "payerId" TEXT,
    "consigneeId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "basis" TEXT,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Waybill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WaybillItem" (
    "id" TEXT NOT NULL,
    "waybillId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "WaybillItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Waybill_number_key" ON "Waybill"("number");
CREATE INDEX "Waybill_clientId_idx" ON "Waybill"("clientId");
CREATE INDEX "Waybill_invoiceId_idx" ON "Waybill"("invoiceId");
CREATE INDEX "Waybill_orderId_idx" ON "Waybill"("orderId");
CREATE INDEX "WaybillItem_waybillId_idx" ON "WaybillItem"("waybillId");

ALTER TABLE "Waybill" ADD CONSTRAINT "Waybill_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Waybill" ADD CONSTRAINT "Waybill_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Waybill" ADD CONSTRAINT "Waybill_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Waybill" ADD CONSTRAINT "Waybill_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Waybill" ADD CONSTRAINT "Waybill_payerId_fkey"
    FOREIGN KEY ("payerId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Waybill" ADD CONSTRAINT "Waybill_consigneeId_fkey"
    FOREIGN KEY ("consigneeId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WaybillItem" ADD CONSTRAINT "WaybillItem_waybillId_fkey"
    FOREIGN KEY ("waybillId") REFERENCES "Waybill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
