-- Внешний вид установки: фирменный цвет, название и значок.
--
-- Система продаётся разным мастерским, и у каждой свой цвет: у нас фиолетовый,
-- у «Дасс» оранжевый. Раньше цвет и название были вбиты в код, и под клиента
-- пришлось бы держать отдельную ветку — а тогда каждая правка умножалась бы на
-- число клиентов. Теперь это данные установки.
--
-- Палитра из цвета считается на лету (lib/brand-palette), поэтому хранится
-- только сам цвет: расходиться нечему.

ALTER TABLE "CompanySettings" ADD COLUMN "brandColor"       TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN "brandName"        TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN "brandTagline"     TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN "interfaceLogoKey" TEXT;
