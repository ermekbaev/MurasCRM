import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/** Общие классы поля ввода — переиспользуются в Select и в инлайновых полях страниц. */
export const fieldClass =
  "h-9.5 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-fg " +
  "placeholder:text-fg-subtle shadow-[inset_0_1px_1px_rgb(16_20_28/0.03)] " +
  "transition-[border-color,box-shadow] duration-150 " +
  "hover:border-slate-300 dark:hover:border-slate-600 " +
  "focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20 " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-subtle";

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, type, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const isPassword = type === "password";
    const [reveal, setReveal] = useState(false);

    const inputEl = (
      <input
        ref={ref}
        id={inputId}
        type={isPassword && reveal ? "text" : type}
        className={cn(
          fieldClass,
          error && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
          isPassword && "pr-10",
          className
        )}
        {...props}
      />
    );

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-fg-muted"
          >
            {label}
          </label>
        )}
        {isPassword ? (
          <div className="relative flex">
            {inputEl}
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Скрыть пароль" : "Показать пароль"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle transition-colors hover:text-fg"
            >
              {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        ) : (
          inputEl
        )}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-fg-subtle">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
