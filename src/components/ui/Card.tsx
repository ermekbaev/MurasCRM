import { cn } from "@/lib/utils";

interface CardProps extends React.ComponentPropsWithoutRef<"div"> {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  /** Приподнимает карточку при наведении — для кликабельных плиток. */
  interactive?: boolean;
}

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-7",
};

export default function Card({
  children,
  className,
  padding = "md",
  interactive,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-xl border border-line bg-surface shadow-card",
        interactive &&
          "transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-raised dark:hover:border-slate-600",
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

/** Заголовок секции внутри карточки с padding="none". */
export function CardHeader({
  title,
  icon,
  action,
  className,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5",
        className
      )}
    >
      <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-fg">
        {icon && <span className="text-fg-subtle">{icon}</span>}
        {title}
      </h2>
      {action}
    </div>
  );
}
