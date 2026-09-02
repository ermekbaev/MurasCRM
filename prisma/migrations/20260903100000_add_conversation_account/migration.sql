-- Наша сторона канала. Для WhatsApp это phone_number_id: у компании может быть
-- несколько номеров, и отвечать нужно с того, на который написал клиент.
ALTER TABLE "Conversation" ADD COLUMN "accountId" TEXT;
