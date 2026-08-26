import {
  OrderStatus,
  Priority,
  PaymentStatus,
  TaskType,
  Role,
  ClientType,
  FileCategory,
  FileStatus,
  ConsumableType,
  EquipmentStatus,
} from "@prisma/client";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  READY: "Готово",
  ISSUED: "Выдано",
  CANCELLED: "Отменено",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  NEW: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25",
  IN_PROGRESS: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25",
  REVIEW: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/25",
  READY: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25",
  ISSUED: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  CANCELLED: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25",
};

// Запасные подписи встроенных типов. Актуальный список — в справочнике (/api/order-types)
export const ORDER_TYPE_LABELS: Record<string, string> = {
  DTF: "DTF-печать",
  UV_DTF: "UV DTF",
  UV_FLATBED: "UV планшет",
  LASER_CUT: "Лазерная резка",
  PLOTTER_CUT: "Плоттерная резка",
  HIGH_PRECISION: "Высокоточная печать",
  COMBO: "Комбо",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Низкий",
  NORMAL: "Обычный",
  URGENT: "Срочный",
  VERY_URGENT: "Очень срочный",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  NORMAL: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25",
  URGENT: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/25",
  VERY_URGENT: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Не оплачен",
  PARTIAL: "Частично оплачен",
  ADVANCE: "Аванс",
  PAID: "Оплачен",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  UNPAID: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25",
  PARTIAL: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/25",
  ADVANCE: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25",
};

/** Запасные подписи. Актуальные этапы — справочник (/api/settings/task-columns). */
export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "К выполнению",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  DONE: "Готово",
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  TODO: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  IN_PROGRESS: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25",
  REVIEW: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/25",
  DONE: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25",
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  DESIGN: "Дизайн",
  FILE_PREP: "Подготовка файла",
  PRINT: "Печать",
  CUT: "Резка",
  LAMINATION: "Ламинация",
  MOUNTING: "Монтаж",
  QC: "Контроль качества",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
  DESIGNER: "Дизайнер",
  OPERATOR: "Оператор",
  ACCOUNTANT: "Бухгалтер",
};

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  INDIVIDUAL: "Физическое лицо",
  LEGAL: "Юридическое лицо",
  IP: "ИП",
};

/** Запасные подписи. Актуальный список — справочник (/api/settings/client-sources). */
export const CLIENT_SOURCE_LABELS: Record<string, string> = {
  REFERRAL: "Рекомендация",
  ADVERTISING: "Реклама",
  COLD_CALL: "Звонок",
  SOCIAL_MEDIA: "Соцсети",
  OTHER: "Другое",
};

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  SOURCES: "Исходники",
  PENDING_APPROVAL: "На согласовании",
  APPROVED: "Утверждённые",
  READY: "Готовые файлы",
  ARCHIVE: "Архив",
};

export const FILE_STATUS_LABELS: Record<FileStatus, string> = {
  UPLOADED: "Загружен",
  PENDING_APPROVAL: "На согласовании",
  APPROVED: "Утверждён",
  REVISION: "На доработке",
};

export const CONSUMABLE_TYPE_LABELS: Record<ConsumableType, string> = {
  DTF_FILM: "DTF-плёнка",
  UV_INK: "UV-чернила",
  VINYL: "Винил",
  BANNER: "Баннерная ткань",
  SUBSTRATE: "Субстрат",
  OTHER: "Другое",
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  ACTIVE: "Работает",
  MAINTENANCE: "На обслуживании",
};

export const ALLOWED_FILE_TYPES = [
  ".ai",
  ".pdf",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".cdr",
  ".dxf",
  ".eps",
  ".tiff",
  ".tif",
];

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  ADMIN: ["*"],
  MANAGER: ["dashboard", "orders", "clients", "invoices", "acts", "calculator", "files", "tasks"],
  DESIGNER: ["tasks", "files", "dashboard"],
  OPERATOR: ["tasks", "dashboard"],
  ACCOUNTANT: ["invoices", "acts", "analytics", "settings/templates", "dashboard"],
};
