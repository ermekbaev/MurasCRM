import type { Role } from "@prisma/client";
import {
  Building2,
  Users,
  Cpu,
  Truck,
  Tag,
  Layers,
  Megaphone,
  FileCode,
} from "lucide-react";

export interface SettingsSection {
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
  /** Группа в под-навигации настроек. */
  group: string;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    label: "Компания",
    description: "Реквизиты, банк, логотип, печать и подпись",
    href: "/settings/company",
    icon: Building2,
    roles: ["ADMIN"],
    group: "Организация",
  },
  {
    label: "Пользователи",
    description: "Сотрудники, роли и доступ в систему",
    href: "/settings/users",
    icon: Users,
    roles: ["ADMIN"],
    group: "Организация",
  },
  {
    label: "Оборудование",
    description: "Станки, тарифы и привязка расходников",
    href: "/settings/equipment",
    icon: Cpu,
    roles: ["ADMIN"],
    group: "Производство",
  },
  {
    label: "Поставщики",
    description: "Контакты и материалы поставщиков",
    href: "/settings/suppliers",
    icon: Truck,
    roles: ["ADMIN", "MANAGER"],
    group: "Производство",
  },
  {
    label: "Типы заявок",
    description: "Справочник видов работ для заявок",
    href: "/settings/order-types",
    icon: Layers,
    roles: ["ADMIN", "MANAGER"],
    group: "Справочники",
  },
  {
    label: "Источники клиентов",
    description: "Откуда приходят клиенты — список для карточки",
    href: "/settings/client-sources",
    icon: Megaphone,
    roles: ["ADMIN", "MANAGER"],
    group: "Справочники",
  },
  {
    label: "Теги",
    description: "Метки для заявок, клиентов и файлов",
    href: "/settings/tags",
    icon: Tag,
    roles: ["ADMIN", "MANAGER"],
    group: "Справочники",
  },
  {
    label: "Шаблоны",
    description: "Печатные формы счетов, актов и договоров",
    href: "/settings/templates",
    icon: FileCode,
    roles: ["ADMIN", "ACCOUNTANT"],
    group: "Документы",
  },
];

export const SETTINGS_GROUP_ORDER = [
  "Организация",
  "Производство",
  "Справочники",
  "Документы",
];

export function settingsSectionsFor(role: Role): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((s) => s.roles.includes(role));
}
