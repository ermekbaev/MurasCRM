-- Вложения переписки и быстрые ответы.
-- Файлы из мессенджера складываем к себе: ссылка Telegram живёт около часа,
-- а история переписки нужна и через год.

CREATE TYPE "AttachmentKind" AS ENUM ('PHOTO', 'DOCUMENT', 'VOICE', 'VIDEO', 'AUDIO', 'STICKER');

CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "size" INTEGER NOT NULL DEFAULT 0,
    "externalId" TEXT,
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Задел под Telegram Business: переписка от лица личного аккаунта менеджера.
-- Колонка добавляется сейчас, чтобы позже подключение не требовало миграции
-- на боевом стенде.
ALTER TABLE "Conversation" ADD COLUMN "businessConnectionId" TEXT;

CREATE TABLE "QuickReply" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuickReply_sortOrder_idx" ON "QuickReply"("sortOrder");
