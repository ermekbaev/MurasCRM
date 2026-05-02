-- CreateEnum
CREATE TYPE "DefectStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable Equipment: drop wastePerJob, add costPerLm
ALTER TABLE "Equipment" DROP COLUMN IF EXISTS "wastePerJob";
ALTER TABLE "Equipment" ADD COLUMN "costPerLm" DECIMAL(12,2);

-- AlterTable OrderItem: drop includeWaste
ALTER TABLE "OrderItem" DROP COLUMN IF EXISTS "includeWaste";

-- CreateTable DefectRecord
CREATE TABLE "DefectRecord" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "orderId" TEXT,
    "qty" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "reason" TEXT,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "DefectStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefectRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DefectRecord_operatorId_idx" ON "DefectRecord"("operatorId");
CREATE INDEX "DefectRecord_equipmentId_idx" ON "DefectRecord"("equipmentId");
CREATE INDEX "DefectRecord_status_idx" ON "DefectRecord"("status");
CREATE INDEX "DefectRecord_createdAt_idx" ON "DefectRecord"("createdAt");

-- AddForeignKey
ALTER TABLE "DefectRecord" ADD CONSTRAINT "DefectRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DefectRecord" ADD CONSTRAINT "DefectRecord_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DefectRecord" ADD CONSTRAINT "DefectRecord_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DefectRecord" ADD CONSTRAINT "DefectRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
