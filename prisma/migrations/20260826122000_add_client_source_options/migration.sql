-- Client.source: enum ClientSource -> text (код из справочника)
ALTER TABLE "Client" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN "source" TYPE TEXT USING "source"::TEXT;
ALTER TABLE "Client" ALTER COLUMN "source" SET DEFAULT 'OTHER';

-- DropEnum
DROP TYPE "ClientSource";

-- CreateTable
CREATE TABLE "ClientSourceOption" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSourceOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientSourceOption_code_key" ON "ClientSourceOption"("code");

-- Переносим встроенные источники в справочник; существующие клиенты уже
-- хранят те же коды, поэтому перемаппинг строк не требуется.
INSERT INTO "ClientSourceOption" ("id", "code", "label", "sortOrder", "updatedAt") VALUES
    ('csrc_referral',     'REFERRAL',     'Рекомендация', 1, CURRENT_TIMESTAMP),
    ('csrc_advertising',  'ADVERTISING',  'Реклама',      2, CURRENT_TIMESTAMP),
    ('csrc_cold_call',    'COLD_CALL',    'Звонок',       3, CURRENT_TIMESTAMP),
    ('csrc_social_media', 'SOCIAL_MEDIA', 'Соцсети',      4, CURRENT_TIMESTAMP),
    ('csrc_other',        'OTHER',        'Другое',       5, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
