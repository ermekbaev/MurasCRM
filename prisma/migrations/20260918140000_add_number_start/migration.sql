-- Стартовый номер нумерации. Нужен при переходе с другой системы: там уже
-- дошли, скажем, до 72-й заявки, и продолжать надо с 73. Вводить номер руками
-- при каждом документе — не вариант, а у заявок номер вручную вообще не задать.
ALTER TABLE "CompanySettings"
  ADD COLUMN "orderStartNumber"   INTEGER,
  ADD COLUMN "invoiceStartNumber" INTEGER,
  ADD COLUMN "actStartNumber"     INTEGER,
  ADD COLUMN "waybillStartNumber" INTEGER,
  -- Год привязки: первого января нумерация начинается заново с единицы,
  -- а не со старой стартовой цифры.
  ADD COLUMN "numberStartYear"    INTEGER;
