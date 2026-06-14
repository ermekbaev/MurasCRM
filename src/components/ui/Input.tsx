import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

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
          "px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400",
          error ? "border-red-400" : "border-slate-300 dark:border-slate-600",
          isPassword && "w-full pr-10",
          className
        )}
        {...props}
      />
    );

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-slate-300">
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          inputEl
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500 dark:text-slate-400">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
