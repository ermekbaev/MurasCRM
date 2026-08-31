/**
 * Единый справочник переменных шаблонов.
 *
 * Источник правды один: отсюда строится подсказка в интерфейсе, и этим же
 * типом типизируется рендер (`api/templates/[id]/render`). Если в рендере
 * появится ключ, которого нет здесь, сборка упадёт — списки не разъедутся.
 */

export interface DocumentVar {
  key: string;
  label: string;
  /** Пример значения — показывается в справочнике. */
  sample: string;
}

export interface DocumentVarGroup {
  title: string;
  hint?: string;
  readonly vars: readonly DocumentVar[];
}

export const DOCUMENT_VAR_GROUPS = [
  {
    title: "Общее",
    vars: [{ key: "date", label: "Сегодняшняя дата", sample: "27.08.2026" }],
  },
  {
    title: "Наша компания",
    hint: "Берутся из Настройки → Компания",
    vars: [
      { key: "company_name", label: "Название", sample: "ООО «Дасс»" },
      { key: "company_inn", label: "ИНН", sample: "7805546998" },
      { key: "company_kpp", label: "КПП", sample: "780501001" },
      { key: "company_ogrn", label: "ОГРН", sample: "1117847082572" },
      { key: "company_address", label: "Юридический адрес", sample: "г. Санкт-Петербург, наб. Обводного канала, 148/150" },
      { key: "company_phone", label: "Телефон", sample: "+7 (812) 300-91-92" },
      { key: "director", label: "Директор", sample: "Иванов И. И." },
      { key: "accountant", label: "Бухгалтер", sample: "Петрова А. С." },
      { key: "bank_name", label: "Банк", sample: "ПАО Сбербанк" },
      { key: "bank_account", label: "Расчётный счёт", sample: "40702810000000000001" },
      { key: "bank_bik", label: "БИК", sample: "044525225" },
      { key: "corr_account", label: "Корреспондентский счёт", sample: "30101810400000000225" },
    ],
  },
  {
    title: "Клиент",
    hint: "Из карточки клиента выбранной заявки или счёта",
    vars: [
      { key: "client_name", label: "Название (краткое)", sample: "ООО «Пример»" },
      { key: "client_full_name", label: "Полное наименование", sample: "Общество с ограниченной ответственностью «Пример»" },
      { key: "client_inn", label: "ИНН", sample: "7700000000" },
      { key: "client_kpp", label: "КПП", sample: "770001001" },
      { key: "client_ogrn", label: "ОГРН", sample: "1157746000000" },
      { key: "client_address", label: "Юридический адрес", sample: "г. Москва, ул. Примерная, 1" },
      { key: "client_phone", label: "Телефон", sample: "+7 (999) 000-00-00" },
      { key: "client_email", label: "Email", sample: "info@example.ru" },
    ],
  },
  {
    title: "Заявка",
    hint: "Заполняются, когда документ формируется из заявки",
    vars: [
      { key: "order_number", label: "Номер заявки", sample: "ЗАК-2026-001" },
      { key: "order_type", label: "Вид работ", sample: "УФ-печать, Лазерная резка" },
      { key: "order_status", label: "Статус", sample: "В работе" },
      { key: "order_deadline", label: "Срок сдачи", sample: "02.09.2026" },
      { key: "order_amount", label: "Сумма заявки", sample: "18 000,00" },
      { key: "payment_status", label: "Статус оплаты", sample: "Не оплачен" },
      { key: "manager_name", label: "Менеджер", sample: "Сергеев С. С." },
      {
        key: "order_items",
        label: "Позиции списком",
        sample: "1. УФ-печать на ПВХ — 3 шт × 6 000,00 = 18 000,00 руб.",
      },
    ],
  },
  {
    title: "Счёт",
    hint: "Заполняются, когда документ формируется из счёта",
    vars: [
      { key: "invoice_number", label: "Номер счёта", sample: "СЧ-2026-001" },
      { key: "invoice_date", label: "Дата счёта", sample: "26.08.2026" },
      { key: "invoice_due_date", label: "Оплатить до", sample: "02.09.2026" },
      { key: "invoice_basis", label: "Основание", sample: "Договор № 7 от 01.08.2026" },
      { key: "subtotal", label: "Сумма без НДС", sample: "15 000,00" },
      { key: "vat", label: "Сумма НДС", sample: "3 000,00" },
      { key: "vat_rate", label: "Ставка НДС", sample: "20" },
      { key: "total", label: "Итого", sample: "18 000,00" },
    ],
  },
] as const satisfies readonly DocumentVarGroup[];

/**
 * Тот же справочник под общим типом — для интерфейса.
 * `as const` выше сужает каждую группу до литерала, из-за чего у групп без
 * `hint` этого поля не существует в типе; здесь оно снова опционально.
 */
export const DOCUMENT_VAR_UI_GROUPS: readonly DocumentVarGroup[] = DOCUMENT_VAR_GROUPS;

/** Все допустимые имена переменных. Рендер типизируется этим объединением. */
export type DocumentVarKey =
  (typeof DOCUMENT_VAR_GROUPS)[number]["vars"][number]["key"];

export const DOCUMENT_VARS: readonly DocumentVar[] = DOCUMENT_VAR_GROUPS.flatMap(
  (g) => [...g.vars],
);

export const DOCUMENT_VAR_KEYS: string[] = DOCUMENT_VARS.map((v) => v.key);
