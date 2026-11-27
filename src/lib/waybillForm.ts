/**
 * УПД и накладная ТОРГ-12 — отдельные документы (Сергей, DASS 27.11). Хранятся одной моделью Waybill с полем form.
 * У старых накладных form пустой: форма выбирается переключателем на странице, как раньше.
 */
export type WaybillForm = "UPD" | "TORG12";

export function waybillLabel(form: string | null | undefined): string {
  if (form === "UPD") return "УПД";
  if (form === "TORG12") return "Накладная ТОРГ-12";
  return "УПД / накладная";
}

/** Подходит ли накладная под нужный вид: старые без вида подходят под оба. */
export function isForm(form: string | null | undefined, want: WaybillForm): boolean {
  return !form || form === want;
}
