import Link from "next/link";
import { auth } from "@/auth";
import { Role } from "@prisma/client";
import { ArrowRight, Settings as SettingsIcon } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { ROLE_LABELS } from "@/lib/constants";
import { SETTINGS_GROUP_ORDER, settingsSectionsFor } from "@/lib/settings-nav";

export default async function SettingsOverviewPage() {
  const session = await auth();
  const role = session!.user.role as Role;
  const sections = settingsSectionsFor(role);

  const grouped = SETTINGS_GROUP_ORDER.map((group) => ({
    group,
    items: sections.filter((s) => s.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-7">
      <PageHeader
        icon={<SettingsIcon size={18} />}
        title="Настройки"
        subtitle={`Справочники и конфигурация системы · доступ: ${ROLE_LABELS[role]}`}
      />

      {grouped.map(({ group, items }) => (
        <section key={group}>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
            {group}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((s) => {
              const Icon = s.icon;
              return (
                <Link key={s.href} href={s.href} className="group block">
                  <Card padding="md" interactive className="h-full">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/15">
                        <Icon className="h-[18px] w-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-fg">
                          {s.label}
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-fg-subtle opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100" />
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                          {s.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
