import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "0 ₽";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return (
    new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num) + " ₽"
  );
}

// Часовой пояс для дат на экране. Без него сервер (UTC) и браузер рисовали разные даты около полуночи, и страница
// заявок падала с ошибкой гидратации React #418 (нашла сквозная проверка 22.11). Менять можно через NEXT_PUBLIC_TIMEZONE.
const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "Europe/Moscow";

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(d);
}


export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/**
 * Наименование контрагента для печатных форм.
 * В документах юрлицо указывается целиком, поэтому берём полное наименование,
 * а короткое (`name`) остаётся для списков и интерфейса.
 */
export function legalName(
  entity: { name?: string | null; fullName?: string | null } | null | undefined,
): string {
  if (!entity) return "";
  const full = entity.fullName?.trim();
  return full || entity.name?.trim() || "";
}
