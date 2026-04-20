import {
  OrderStatus,
  OrderType,
  Priority,
  PaymentStatus,
  TaskStatus,
  TaskType,
  Role,
  ClientType,
  ClientSource,
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
  NEW: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  REVIEW: "bg-purple-100 text-purple-800",
  READY: "bg-green-100 text-green-800",
  ISSUED: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
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
  LOW: "bg-gray-100 text-gray-600",
  NORMAL: "bg-blue-100 text-blue-700",
  URGENT: "bg-orange-100 text-orange-700",
  VERY_URGENT: "bg-red-100 text-red-700",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Не оплачен",
  ADVANCE: "Аванс",
  PAID: "Оплачен",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  UNPAID: "bg-red-100 text-red-700",
  ADVANCE: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "К выполнению",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  DONE: "Готово",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  REVIEW: "bg-purple-100 text-purple-700",
  DONE: "bg-green-100 text-green-700",
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

export const CLIENT_SOURCE_LABELS: Record<ClientSource, string> = {
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
