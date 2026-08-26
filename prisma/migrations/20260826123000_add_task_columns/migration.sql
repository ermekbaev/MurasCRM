-- Task.status: enum TaskStatus -> text (код этапа из справочника)
ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'TODO';

-- DropEnum
DROP TYPE "TaskStatus";

-- CreateTable
CREATE TABLE "TaskColumn" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isStart" BOOLEAN NOT NULL DEFAULT false,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskColumn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskColumn_code_key" ON "TaskColumn"("code");

-- Переносим текущие статусы в справочник. Коды не меняются, поэтому
-- существующие задачи перемаппинга не требуют.
-- isStart проставляет startedAt, isFinal — finishedAt.
INSERT INTO "TaskColumn" ("id", "code", "name", "color", "sortOrder", "isStart", "isFinal", "updatedAt") VALUES
    ('tcol_todo',        'TODO',        'К выполнению', '#64748b', 1, false, false, CURRENT_TIMESTAMP),
    ('tcol_in_progress', 'IN_PROGRESS', 'В работе',     '#0ea5e9', 2, true,  false, CURRENT_TIMESTAMP),
    ('tcol_review',      'REVIEW',      'На проверке',  '#8b5cf6', 3, false, false, CURRENT_TIMESTAMP),
    ('tcol_done',        'DONE',        'Готово',       '#10b981', 4, false, true,  CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
