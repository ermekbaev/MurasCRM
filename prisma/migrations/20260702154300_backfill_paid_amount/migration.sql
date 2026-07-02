-- Backfill: полностью оплаченные заявки получают paidAmount = amount,
-- чтобы новый учёт остатков не показывал по ним ложный долг.
UPDATE "Order" SET "paidAmount" = "amount" WHERE "paymentStatus" = 'PAID';
