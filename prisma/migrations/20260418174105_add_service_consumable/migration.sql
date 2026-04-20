-- CreateTable
CREATE TABLE "ServiceConsumable" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "consumableId" TEXT NOT NULL,
    "qtyPerUnit" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "ServiceConsumable_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ServiceConsumable" ADD CONSTRAINT "ServiceConsumable_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceConsumable" ADD CONSTRAINT "ServiceConsumable_consumableId_fkey" FOREIGN KEY ("consumableId") REFERENCES "Consumable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
