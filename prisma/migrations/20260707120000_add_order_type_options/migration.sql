-- Order.type: enum OrderType -> text
ALTER TABLE "Order" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;
ALTER TABLE "Order" ALTER COLUMN "type" SET DEFAULT 'DTF';

-- DropEnum
DROP TYPE "OrderType";

-- CreateTable
CREATE TABLE "OrderTypeOption" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderTypeOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderTypeOption_code_key" ON "OrderTypeOption"("code");

-- Seed existing (built-in) order types
INSERT INTO "OrderTypeOption" ("id", "code", "label", "sortOrder", "updatedAt") VALUES
    ('otype_dtf',           'DTF',            'DTF-печать',           1, CURRENT_TIMESTAMP),
    ('otype_uv_dtf',        'UV_DTF',         'UV DTF',               2, CURRENT_TIMESTAMP),
    ('otype_uv_flatbed',    'UV_FLATBED',     'UV планшет',           3, CURRENT_TIMESTAMP),
    ('otype_laser_cut',     'LASER_CUT',      'Лазерная резка',       4, CURRENT_TIMESTAMP),
    ('otype_plotter_cut',   'PLOTTER_CUT',    'Плоттерная резка',     5, CURRENT_TIMESTAMP),
    ('otype_high_precision','HIGH_PRECISION', 'Высокоточная печать',  6, CURRENT_TIMESTAMP),
    ('otype_combo',         'COMBO',          'Комбо',                7, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
