-- Учёт денег: счета, статьи и расходы.
--
-- Раньше расходов в системе не было совсем, и прибыль в аналитике считалась
-- только по себестоимости производства — без аренды, закупок и рекламы,
-- то есть получалась завышенной.

CREATE TYPE "MoneyAccountKind" AS ENUM ('CASH', 'CARD', 'BANK');

-- Счета и кассы ведёт сам владелец: у каждого свои карты.
CREATE TABLE "MoneyAccount" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "kind"         "MoneyAccountKind" NOT NULL DEFAULT 'CASH',
    -- Остаток на момент начала учёта: без него виден только оборот.
    "startBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder"    INTEGER NOT NULL DEFAULT 0,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MoneyAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpenseCategory" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Expense" (
    "id"          TEXT NOT NULL,
    "date"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount"      DECIMAL(12,2) NOT NULL,
    "accountId"   TEXT,
    "categoryId"  TEXT,
    "comment"     TEXT NOT NULL DEFAULT '',
    "orderId"     TEXT,
    "supplierId"  TEXT,
    "userId"      TEXT,
    "userName"    TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "deletedAt"   TIMESTAMP(3),
    "deletedById" TEXT,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Expense_date_idx"       ON "Expense"("date");
CREATE INDEX "Expense_accountId_idx"  ON "Expense"("accountId");
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
CREATE INDEX "Expense_deletedAt_idx"  ON "Expense"("deletedAt");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "MoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Приход: куда пришли деньги и от кого. Клиент становится необязательным —
-- наличные «просто принесли» тоже надо записывать. Заодно меняется поведение
-- при удалении клиента: платёж больше не исчезает вместе с ним, а остаётся
-- в кассе без привязки, иначе деньги пропадали бы из отчёта задним числом.
ALTER TABLE "Payment" ALTER COLUMN "clientId" DROP NOT NULL;
ALTER TABLE "Payment" ADD COLUMN "accountId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "comment" TEXT NOT NULL DEFAULT '';

-- Дата прихода отдельно от даты записи: деньги заносят и задним числом.
-- У старых платежей даты нет, поэтому берём день, когда их записали.
ALTER TABLE "Payment" ADD COLUMN "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Payment" SET "date" = "createdAt";

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_clientId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "MoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Payment_accountId_idx" ON "Payment"("accountId");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");
CREATE INDEX "Payment_date_idx"      ON "Payment"("date");
