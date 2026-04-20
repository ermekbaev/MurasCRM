-- AlterTable: remove type column from Order (type is now derived from items/services)
ALTER TABLE "Order" DROP COLUMN "type";
