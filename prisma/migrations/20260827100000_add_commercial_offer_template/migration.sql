-- Коммерческое предложение как отдельный тип шаблона.
-- Раньше КП пришлось бы заводить как OTHER.
ALTER TYPE "DocumentTemplateType" ADD VALUE IF NOT EXISTS 'COMMERCIAL_OFFER';
