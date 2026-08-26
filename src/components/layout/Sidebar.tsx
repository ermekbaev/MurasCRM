"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  CheckSquare,
  Users,
  FileText,
  ClipboardList,
  FolderOpen,
  Package,
  BarChart3,
  History,
  Settings,
  Cpu,
  Truck,
  FileSpreadsheet,
  LogOut,
  Sun,
  Moon,
  AlertTriangle,
  X,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { settingsSectionsFor } from "@/lib/settings-nav";
import { ROLE_LABELS } from "@/lib/constants";
import Image from "next/image";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL: Role[] = ["ADMIN", "MANAGER", "DESIGNER", "OPERATOR", "ACCOUNTANT"];

const navGroups: NavGroup[] = [
  {
    label: "Работа",
    items: [
      { label: "Дашборд", href: "/dashboard", icon: LayoutDashboard, roles: ALL },
      { label: "Заявки", href: "/orders", icon: ShoppingCart, roles: ["ADMIN", "MANAGER", "DESIGNER", "OPERATOR"] },
      { label: "Задачи", href: "/tasks", icon: CheckSquare, roles: ["ADMIN", "MANAGER", "DESIGNER", "OPERATOR"] },
      { label: "Файловый хаб", href: "/files", icon: FolderOpen, roles: ["ADMIN", "MANAGER", "DESIGNER"] },
    ],
  },
  {
    label: "Клиенты и деньги",
    items: [
      { label: "Клиенты", href: "/clients", icon: Users, roles: ["ADMIN", "MANAGER"] },
      { label: "Счета", href: "/invoices", icon: FileText, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { label: "Акты", href: "/acts", icon: ClipboardList, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { label: "Накладные", href: "/waybills", icon: FileSpreadsheet, roles: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
      { label: "Аналитика", href: "/analytics", icon: BarChart3, roles: ["ADMIN", "ACCOUNTANT"] },
    ],
  },
  {
    label: "Производство",
    items: [
      { label: "Оборудование", href: "/settings/equipment", icon: Cpu, roles: ["ADMIN"] },
      { label: "Расходники", href: "/consumables", icon: Package, roles: ["ADMIN", "MANAGER"] },
      { label: "Поставщики", href: "/settings/suppliers", icon: Truck, roles: ["ADMIN", "MANAGER"] },
      { label: "Журнал брака", href: "/defects", icon: AlertTriangle, roles: ["ADMIN", "MANAGER", "OPERATOR"] },
      { label: "Журнал изменений", href: "/changelog", icon: History, roles: ["ADMIN"] },
    ],
  },
];

interface SidebarProps {
  role: Role;
  userName: string;
  userEmail: string;
  onClose?: () => void;
}

export default function Sidebar({ role, userName, userEmail, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const groups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);

  // Настройки — один пункт меню; внутренние разделы живут в собственной навигации.
  const showSettings = settingsSectionsFor(role).length > 0;
  // Оборудование и Поставщики живут под /settings/*, но продублированы в основном
  // меню — на них подсвечивается свой пункт, а не «Настройки».
  const promoted = navGroups.some((g) => g.items.some((i) => i.href === pathname));
  const settingsActive =
    !promoted && (pathname === "/settings" || pathname.startsWith("/settings/"));

  const itemClass = (active: boolean) =>
    cn(
      "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150",
      active
        ? "bg-accent-soft font-semibold text-accent-fg ring-1 ring-inset ring-accent/15"
        : "font-medium text-fg-muted hover:bg-surface-hover hover:text-fg"
    );

  const iconClass = (active: boolean) =>
    cn(
      "h-[17px] w-[17px] shrink-0 transition-colors",
      active ? "text-accent" : "text-fg-subtle group-hover:text-fg-muted"
    );

  return (
    <aside className="flex h-full min-h-screen w-64 shrink-0 flex-col border-r border-line bg-rail">
      {/* Бренд */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface shadow-card">
          <Image src="/logo.svg" alt="Muras-Brand" width={22} height={22} className="object-contain" priority />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-semibold tracking-tight text-fg">Muras-Brand</p>
          <p className="truncate text-[11px] text-fg-subtle">CRM производства</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Закрыть меню"
            className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Навигация */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {groups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href} onClick={onClose} className={itemClass(active)}>
                    <Icon className={iconClass(active)} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Низ: настройки, тема, пользователь */}
      <div className="shrink-0 border-t border-line p-3">
        {showSettings && (
          <Link href="/settings" onClick={onClose} className={cn(itemClass(settingsActive), "mb-1")}>
            <Settings className={iconClass(settingsActive)} />
            <span className="truncate">Настройки</span>
          </Link>
        )}

        <button
          onClick={toggleTheme}
          className="group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
        >
          {theme === "dark" ? (
            <Sun className="h-[17px] w-[17px] shrink-0 text-fg-subtle group-hover:text-fg-muted" />
          ) : (
            <Moon className="h-[17px] w-[17px] shrink-0 text-fg-subtle group-hover:text-fg-muted" />
          )}
          <span className="truncate">{theme === "dark" ? "Светлая тема" : "Тёмная тема"}</span>
        </button>

        <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-line bg-surface p-2 shadow-card">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs font-semibold text-accent-fg ring-1 ring-inset ring-accent/15">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-medium text-fg">{userName}</p>
            <p className="truncate text-[11px] text-fg-subtle" title={userEmail}>
              {ROLE_LABELS[role]}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-red-600 dark:hover:text-red-400"
            title="Выйти"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
