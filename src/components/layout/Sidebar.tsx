"use client";

import { useEffect, useState } from "react";
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
  Trash2,
  Settings,
  MessagesSquare,
  Cpu,
  Truck,
  FileSpreadsheet,
  Wallet,
  LogOut,
  Sun,
  Moon,
  AlertTriangle,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { settingsSectionsFor } from "@/lib/settings-nav";
import { CHAT_ROLES } from "@/lib/chat-roles";
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
      { label: "Переписка", href: "/chats", icon: MessagesSquare, roles: ["ADMIN", "MANAGER", "DESIGNER", "ACCOUNTANT"] },
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
      { label: "Деньги", href: "/money", icon: Wallet, roles: ["ADMIN", "ACCOUNTANT"] },
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
      { label: "Корзина", href: "/trash", icon: Trash2, roles: ["ADMIN"] },
    ],
  },
];

interface SidebarProps {
  role: Role;
  userName: string;
  userEmail: string;
  /** Название, подпись и значок установки — у каждого клиента свои. */
  brand: { name: string; tagline: string; logo: string };
  /** Свёрнут до иконок (только на десктопе). */
  collapsed?: boolean;
  /** Переключить свёрнутость — кнопка на десктопе. */
  onToggleCollapse?: () => void;
  onClose?: () => void;
}

export default function Sidebar({
  role,
  userName,
  userEmail,
  brand,
  collapsed = false,
  onToggleCollapse,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const unread = useUnreadChats(role);
  const [wideLogo, setWideLogo] = useState(false);

  // Широким считаем логотип, который заметно длиннее своей высоты: в нём
  // почти всегда набрано название, и в квадратике 22×22 он превратился бы
  // в нечитаемую полоску.
  const measureLogo = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalHeight > 0) setWideLogo(img.naturalWidth / img.naturalHeight > 1.6);
  };

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

  // Свёрнутость действует только на десктопе (lg+): на телефоне меню всегда
  // раскрыто — там это выезжающая панель во всю ширину. Поэтому прячем подписи
  // и центрируем иконки классами lg:*, а не убираем из разметки.
  const hideLabel = collapsed ? "lg:hidden" : "";

  const itemClass = (active: boolean) =>
    cn(
      "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150",
      collapsed && "lg:justify-center lg:gap-0 lg:px-0",
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
    <aside
      className={cn(
        "flex h-full min-h-screen shrink-0 flex-col border-r border-line bg-rail transition-[width] duration-200",
        collapsed ? "w-64 lg:w-16" : "w-64"
      )}
    >
      {/* Бренд */}
      <div className={cn("flex h-16 shrink-0 items-center gap-2.5 px-4", collapsed && "lg:justify-center lg:px-0")}>
        {/* Развёрнутая шапка. Свёрнута — прячем её на десктопе (lg:hidden),
            на телефоне остаётся, там меню всегда полное. */}
        <div className={cn("flex flex-1 items-center gap-2.5 overflow-hidden", collapsed && "lg:hidden")}>
          {/* Логотипы у всех разной формы. Широкий — с названием внутри, его
              растягиваем на всю шапку и подпись рядом не повторяем. Квадратный
              знак ставим в рамку и подписываем. Пропорции меряем по картинке. */}
          {wideLogo ? (
            <Image
              src={brand.logo}
              alt={brand.name}
              width={180}
              height={28}
              onLoad={measureLogo}
              className="h-7 w-auto max-w-[180px] shrink-0 object-contain object-left"
              unoptimized
              priority
            />
          ) : (
            <>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface shadow-card">
                <Image
                  src={brand.logo}
                  alt={brand.name}
                  width={22}
                  height={22}
                  onLoad={measureLogo}
                  className="h-[22px] w-[22px] object-contain"
                  unoptimized
                  priority
                />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13px] font-semibold tracking-tight text-fg">{brand.name}</p>
                <p className="truncate text-[11px] text-fg-subtle">{brand.tagline}</p>
              </div>
            </>
          )}
        </div>

        {/* Свёрнутая шапка на десктопе: только квадратный значок по центру. */}
        {collapsed && (
          <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface shadow-card lg:flex">
            <Image
              src={brand.logo}
              alt={brand.name}
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
              unoptimized
            />
          </div>
        )}

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
      <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3", collapsed && "lg:px-2")}>
        {groups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <p className={cn("mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-subtle", hideLabel)}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    title={collapsed ? item.label : undefined}
                    className={itemClass(active)}
                  >
                    <Icon className={iconClass(active)} />
                    <span className={cn("truncate", hideLabel)}>{item.label}</span>
                    {item.href === "/chats" && unread > 0 && (
                      // В свёрнутом виде метка превращается в точку на иконке.
                      <span
                        className={cn(
                          "shrink-0 rounded-full bg-accent text-on-accent",
                          collapsed
                            ? "lg:absolute lg:right-1 lg:top-1 lg:h-2 lg:w-2 lg:p-0 ml-auto px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                            : "ml-auto px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                        )}
                      >
                        <span className={collapsed ? "lg:hidden" : ""}>{unread > 99 ? "99+" : unread}</span>
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Низ: настройки, тема, пользователь */}
      <div className={cn("shrink-0 border-t border-line p-3", collapsed && "lg:px-2")}>
        {/* Свернуть / развернуть — только на десктопе. */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Развернуть меню" : "Свернуть меню"}
            className={cn(
              "mb-1 hidden h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg lg:flex",
              collapsed && "lg:justify-center lg:gap-0 lg:px-0"
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[17px] w-[17px] shrink-0 text-fg-subtle" />
            ) : (
              <PanelLeftClose className="h-[17px] w-[17px] shrink-0 text-fg-subtle" />
            )}
            <span className={hideLabel}>Свернуть</span>
          </button>
        )}

        {showSettings && (
          <Link
            href="/settings"
            onClick={onClose}
            title={collapsed ? "Настройки" : undefined}
            className={cn(itemClass(settingsActive), "mb-1")}
          >
            <Settings className={iconClass(settingsActive)} />
            <span className={cn("truncate", hideLabel)}>Настройки</span>
          </Link>
        )}

        <button
          onClick={toggleTheme}
          title={collapsed ? (theme === "dark" ? "Светлая тема" : "Тёмная тема") : undefined}
          className={cn(
            "group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg",
            collapsed && "lg:justify-center lg:gap-0 lg:px-0"
          )}
        >
          {theme === "dark" ? (
            <Sun className="h-[17px] w-[17px] shrink-0 text-fg-subtle group-hover:text-fg-muted" />
          ) : (
            <Moon className="h-[17px] w-[17px] shrink-0 text-fg-subtle group-hover:text-fg-muted" />
          )}
          <span className={cn("truncate", hideLabel)}>{theme === "dark" ? "Светлая тема" : "Тёмная тема"}</span>
        </button>

        <div
          className={cn(
            "mt-2 flex items-center gap-2.5 rounded-lg border border-line bg-surface p-2 shadow-card",
            collapsed && "lg:flex-col lg:gap-1 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
          )}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs font-semibold text-accent-fg ring-1 ring-inset ring-accent/15"
            title={collapsed ? `${userName} · ${ROLE_LABELS[role]}` : undefined}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className={cn("min-w-0 flex-1 leading-tight", hideLabel)}>
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

/**
 * Непрочитанные сообщения для значка в меню.
 *
 * Меню живёт на каждой странице, поэтому запрос намеренно лёгкий, а интервал
 * редкий: точное время прихода видно на самой странице переписки, здесь важно
 * только заметить, что клиент написал.
 */
function useUnreadChats(role: Role): number {
  const [unread, setUnread] = useState(0);
  const visible = CHAT_ROLES.includes(role);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    const load = () => {
      fetch("/api/conversations/unread")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && typeof d?.unread === "number") setUnread(d.unread);
        })
        .catch(() => {});
    };

    load();
    const timer = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [visible]);

  return unread;
}
