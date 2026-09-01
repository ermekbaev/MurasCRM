-- DOCX-шаблоны: клиент загружает свой бланк с нашими переменными,
-- система подставляет данные и отдаёт готовый документ.
CREATE TYPE "DocumentTemplateKind" AS ENUM ('TEXT', 'DOCX');

ALTER TABLE "DocumentTemplate" ADD COLUMN "kind" "DocumentTemplateKind" NOT NULL DEFAULT 'TEXT';
ALTER TABLE "DocumentTemplate" ADD COLUMN "fileKey" TEXT;
ALTER TABLE "DocumentTemplate" ADD COLUMN "fileName" TEXT;
ALTER TABLE "DocumentTemplate" ALTER COLUMN "body" SET DEFAULT '';
