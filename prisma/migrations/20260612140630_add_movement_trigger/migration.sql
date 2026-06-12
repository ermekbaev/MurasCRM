-- AlterTable
ALTER TABLE "ConsumableMovement" ADD COLUMN     "trigger" "ConsumableDeductTrigger";

-- CreateIndex
CREATE INDEX "ConsumableMovement_orderId_trigger_idx" ON "ConsumableMovement"("orderId", "trigger");
