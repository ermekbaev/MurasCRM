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
  LogOut,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import Image from "next/image";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
  children?: { label: string; href: string; roles: Role[] }[];
}

const navItems: NavItem[] = [
  {
    label: "Дашборд",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "MANAGER", "DESIGNER", "OPERATOR", "ACCOUNTANT"],
  },
  {
    label: "Заявки",
    href: "/orders",
    icon: ShoppingCart,
    roles: ["ADMIN", "MANAGER", "DESIGNER", "OPERATOR"],
  },
  {
    label: "Задачи",
    href: "/tasks",
    icon: CheckSquare,
    roles: ["ADMIN", "MANAGER", "DESIGNER", "OPERATOR"],
  },
  {
    label: "Клиенты",
    href: "/clients",
    icon: Users,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Счета",
    href: "/invoices",
    icon: FileText,
    roles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
  },
  {
    label: "Акты",
    href: "/acts",
    icon: ClipboardList,
    roles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
  },
  {
    label: "Файловый хаб",
    href: "/files",
    icon: FolderOpen,
    roles: ["ADMIN", "MANAGER", "DESIGNER"],
  },
  {
    label: "Расходники",
    href: "/consumables",
    icon: Package,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "Аналитика",
    href: "/analytics",
    icon: BarChart3,
    roles: ["ADMIN", "ACCOUNTANT"],
  },
  {
    label: "Журнал изменений",
    href: "/changelog",
    icon: History,
    roles: ["ADMIN"],
  },
];

const settingsItems = [
  { label: "Компания", href: "/settings/company", roles: ["ADMIN"] as Role[] },
  {
    label: "Пользователи",
    href: "/settings/users",
    roles: ["ADMIN"] as Role[],
  },
  { label: "Услуги", href: "/settings/services", roles: ["ADMIN"] as Role[] },
  {
    label: "Оборудование",
    href: "/settings/equipment",
    roles: ["ADMIN"] as Role[],
  },
  {
    label: "Поставщики",
    href: "/settings/suppliers",
    roles: ["ADMIN", "MANAGER"] as Role[],
  },
  {
    label: "Теги",
    href: "/settings/tags",
    roles: ["ADMIN", "MANAGER"] as Role[],
  },
  {
    label: "Шаблоны",
    href: "/settings/templates",
    roles: ["ADMIN", "ACCOUNTANT"] as Role[],
  },
];

interface SidebarProps {
  role: Role;
  userName: string;
  userEmail: string;
}

export default function Sidebar({ role, userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith("/settings"),
  );

  const filteredNav = navItems.filter((item) => item.roles.includes(role));
  const filteredSettings = settingsItems.filter((item) =>
    item.roles.includes(role),
  );
  const showSettings = filteredSettings.length > 0;

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-slate-50 border-r border-slate-200 shrink-0">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-4 border-b border-slate-200">
        <Image
          src="/logo.svg"
          alt="Muras-Brand"
          width={50}
          height={32}
          className="object-contain shrink-0"
          priority
        />
        <span className="text-sm font-semibold text-slate-700 leading-tight">
          Muras-Brand
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                active
                  ? "bg-violet-600 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active
                    ? "text-violet-100"
                    : "text-slate-400 group-hover:text-slate-600",
                )}
              />
              {item.label}
              {active && (
                <ChevronRight className="ml-auto h-3 w-3 text-violet-300" />
              )}
            </Link>
          );
        })}

        {/* Settings */}
        {showSettings && (
          <div className="pt-4">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Настройки
            </p>
            <div className="space-y-0.5">
              {filteredSettings.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                      active
                        ? "bg-violet-600 text-white"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                    )}
                  >
                    <Settings
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active
                          ? "text-violet-100"
                          : "text-slate-400 group-hover:text-slate-600",
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-100 transition-colors">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-700">
              {userName}
            </p>
            <p className="truncate text-[11px] text-slate-400">{userEmail}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-1 rounded text-slate-300 hover:text-slate-500 transition-colors"
            title="Выйти"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
