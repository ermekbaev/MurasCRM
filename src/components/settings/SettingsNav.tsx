"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";
import {
  SETTINGS_GROUP_ORDER,
  settingsSectionsFor,
  type SettingsSection,
} from "@/lib/settings-nav";

export default function SettingsNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const sections = settingsSectionsFor(role);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const grouped = SETTINGS_GROUP_ORDER.map((group) => ({
    group,
    items: sections.filter((s) => s.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {/* Мобильная и планшетная навигация — горизонтальная лента */}
      <div className="-mx-4 border-b border-line px-4 pb-3 sm:-mx-6 sm:px-6 lg:hidden">
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Tab href="/settings" label="Обзор" active={pathname === "/settings"} />
          {sections.map((s) => (
            <Tab key={s.href} href={s.href} label={s.label} active={isActive(s.href)} icon={s.icon} />
          ))}
        </div>
      </div>

      {/* Десктопная навигация — собственный сайдбар раздела */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-6">
          <Link
            href="/settings"
            className={cn(
              "mb-4 flex items-center gap-2.5 rounded-xl border border-line bg-surface p-3 shadow-card transition-colors",
              pathname === "/settings" ? "ring-1 ring-inset ring-accent/25" : "hover:bg-surface-hover"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/15">
              <Settings className="h-4 w-4" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-[13px] font-semibold tracking-tight text-fg">Настройки</p>
              <p className="truncate text-[11px] text-fg-subtle">Обзор разделов</p>
            </div>
          </Link>

          <nav className="space-y-4">
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {items.map((s) => {
                    const Icon = s.icon;
                    const active = isActive(s.href);
                    return (
                      <Link
                        key={s.href}
                        href={s.href}
                        className={cn(
                          "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150",
                          active
                            ? "bg-accent-soft font-semibold text-accent-fg ring-1 ring-inset ring-accent/15"
                            : "font-medium text-fg-muted hover:bg-surface-hover hover:text-fg"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-[17px] w-[17px] shrink-0",
                            active ? "text-accent" : "text-fg-subtle group-hover:text-fg-muted"
                          )}
                        />
                        <span className="truncate">{s.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}

function Tab({
  href,
  label,
  active,
  icon: Icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon?: SettingsSection["icon"];
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] transition-colors",
        active
          ? "border-accent/20 bg-accent-soft font-semibold text-accent-fg"
          : "border-line bg-surface font-medium text-fg-muted hover:bg-surface-hover hover:text-fg"
      )}
    >
      {Icon && <Icon className={cn("h-4 w-4", active ? "text-accent" : "text-fg-subtle")} />}
      {label}
    </Link>
  );
}
