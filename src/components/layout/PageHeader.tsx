import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Иконка раздела слева от заголовка. */
  icon?: React.ReactNode;
  /** Ссылка «назад» над заголовком. */
  back?: { href: string; label: string };
  /** Кнопка «назад» для локальной навигации внутри страницы. */
  onBack?: { onClick: () => void; label: string };
  /** Кнопки справа. */
  actions?: React.ReactNode;
  /** Дополнительный ряд под заголовком: статусы, метрики, табы. */
  meta?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  icon,
  back,
  onBack,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-5", className)}>
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-fg-subtle transition-colors hover:text-fg"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {back.label}
        </Link>
      )}

      {onBack && (
        <button
          type="button"
          onClick={onBack.onClick}
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-fg-subtle transition-colors hover:text-fg"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {onBack.label}
        </button>
      )}

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-fg-muted shadow-card">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-fg sm:text-[22px]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 text-[13px] text-fg-muted">{subtitle}</p>
            )}
          </div>
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {meta && <div className="mt-4">{meta}</div>}
    </div>
  );
}
