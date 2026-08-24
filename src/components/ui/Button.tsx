import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

const variants = {
  primary:
    "bg-accent text-white shadow-[0_1px_2px_rgb(16_20_28/0.16)] hover:bg-accent-hover active:bg-accent-active",
  secondary:
    "bg-surface-hover text-fg hover:bg-line-soft dark:hover:bg-line",
  danger:
    "bg-red-600 text-white shadow-[0_1px_2px_rgb(16_20_28/0.16)] hover:bg-red-700 active:bg-red-800",
  ghost: "text-fg-muted hover:bg-surface-hover hover:text-fg",
  outline:
    "border border-line bg-surface text-fg hover:bg-surface-hover hover:border-slate-300 dark:hover:border-slate-600",
};

const sizes = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9.5 px-4 text-[13px] gap-2",
  lg: "h-11 px-6 text-sm gap-2",
  icon: "h-9 w-9 p-0",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium",
          "transition-[background-color,border-color,color,box-shadow,transform] duration-150",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          "active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
