import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "secondary" | "accent";
  /** Точка-индикатор слева от текста. */
  dot?: boolean;
}

const variants = {
  default:
    "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  success:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25",
  warning:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25",
  danger:
    "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25",
  info:
    "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25",
  secondary:
    "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-accent/10 dark:text-violet-300 dark:ring-violet-500/25",
  accent:
    "bg-accent-soft text-accent-fg ring-accent/20",
};

const dotColors = {
  default: "bg-slate-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
  secondary: "bg-accent",
  accent: "bg-accent",
};

export default function Badge({ children, className, variant = "default", dot }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium leading-5 ring-1 ring-inset",
        variants[variant],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColors[variant])} />}
      {children}
    </span>
  );
}
