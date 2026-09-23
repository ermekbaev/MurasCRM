/**
 * Период для денежных отчётов.
 *
 * По умолчанию — текущий месяц: так владелец сверяет кассу чаще всего.
 * Даты приходят строками `YYYY-MM-DD`, конец дня включается целиком, иначе
 * расходы, записанные сегодня, не попадали бы в отчёт «по сегодня».
 */
export function periodRange(params: URLSearchParams): { from: Date; to: Date } {
  const now = new Date();
  const fromParam = params.get("from");
  const toParam = params.get("to");

  const from = fromParam
    ? new Date(`${fromParam}T00:00:00`)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toParam ? new Date(`${toParam}T23:59:59.999`) : endOfDay(now);

  return {
    from: Number.isNaN(from.getTime()) ? new Date(now.getFullYear(), now.getMonth(), 1) : from,
    to: Number.isNaN(to.getTime()) ? endOfDay(now) : to,
  };
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** `YYYY-MM-DD` для полей формы. */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
