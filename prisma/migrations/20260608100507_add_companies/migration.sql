-- AlterTable
ALTER TABLE "Act" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "companyId" TEXT;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "inn" TEXT NOT NULL DEFAULT '',
    "kpp" TEXT NOT NULL DEFAULT '',
    "ogrn" TEXT NOT NULL DEFAULT '',
    "legalAddress" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "bankAccount" TEXT NOT NULL DEFAULT '',
    "bankBik" TEXT NOT NULL DEFAULT '',
    "corrAccount" TEXT NOT NULL DEFAULT '',
    "director" TEXT NOT NULL DEFAULT '',
    "accountant" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Act" ADD CONSTRAINT "Act_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
