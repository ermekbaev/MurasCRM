/*
  Warnings:

  - You are about to drop the column `serviceId` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the `Service` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServiceConsumable` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ConsumableDeductTrigger" AS ENUM ('MANUAL', 'ON_IN_PROGRESS', 'ON_READY');

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceConsumable" DROP CONSTRAINT "ServiceConsumable_consumableId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceConsumable" DROP CONSTRAINT "ServiceConsumable_serviceId_fkey";

-- AlterTable
ALTER TABLE "ConsumableMovement" ADD COLUMN     "orderItemId" TEXT;

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "wastePerJob" DECIMAL(8,3),
ALTER COLUMN "pricingUnit" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "serviceId",
ADD COLUMN     "equipmentId" TEXT,
ADD COLUMN     "includeWaste" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "Service";

-- DropTable
DROP TABLE "ServiceConsumable";

-- CreateTable
CREATE TABLE "EquipmentConsumable" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "consumableId" TEXT NOT NULL,
    "consumptionPerUnit" DECIMAL(10,4) NOT NULL,
    "autoDeduct" BOOLEAN NOT NULL DEFAULT true,
    "trigger" "ConsumableDeductTrigger" NOT NULL DEFAULT 'ON_IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentConsumable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentConsumable_equipmentId_consumableId_key" ON "EquipmentConsumable"("equipmentId", "consumableId");

-- CreateIndex
CREATE INDEX "ConsumableMovement_consumableId_idx" ON "ConsumableMovement"("consumableId");

-- CreateIndex
CREATE INDEX "ConsumableMovement_orderItemId_idx" ON "ConsumableMovement"("orderItemId");

-- CreateIndex
CREATE INDEX "ConsumableMovement_orderItemId_consumableId_idx" ON "ConsumableMovement"("orderItemId", "consumableId");

-- CreateIndex
CREATE INDEX "File_uploadedById_idx" ON "File"("uploadedById");

-- CreateIndex
CREATE INDEX "File_linkedId_idx" ON "File"("linkedId");

-- CreateIndex
CREATE INDEX "Order_clientId_idx" ON "Order"("clientId");

-- CreateIndex
CREATE INDEX "Order_managerId_idx" ON "Order"("managerId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_equipmentId_idx" ON "OrderItem"("equipmentId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_orderId_idx" ON "Task"("orderId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentConsumable" ADD CONSTRAINT "EquipmentConsumable_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentConsumable" ADD CONSTRAINT "EquipmentConsumable_consumableId_fkey" FOREIGN KEY ("consumableId") REFERENCES "Consumable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableMovement" ADD CONSTRAINT "ConsumableMovement_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
