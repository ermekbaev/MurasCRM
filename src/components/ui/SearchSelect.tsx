"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/Input";

interface Option {
  value: string;
  label: string;
}

/**
 * Выпадающий список с поиском по вводу — для длинных справочников (например,
 * клиентов), где обычный <select> неудобно листать. `extraOption` всегда
 * показывается внизу (например «+ Новый клиент») и не прячется при поиске.
 */
export default function SearchSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Выберите",
  extraOption,
  disabled,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  extraOption?: Option;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const query = q.trim().toLowerCase();
  const filtered = query ? options.filter((o) => o.label.toLowerCase().includes(query)) : options;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQ("");
  }

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      {label && <label className="text-sm font-medium text-fg-muted">{label}</label>}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={cn(fieldClass, "flex items-center justify-between gap-2 text-left")}
        >
          <span className={cn("truncate", selected ? "text-fg" : "text-fg-subtle")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-fg-subtle" />
        </button>

        {open && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
            <div className="border-b border-line-soft p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Поиск…"
                  className="w-full rounded-md border border-line bg-surface py-1.5 pl-8 pr-2 text-[13px] text-fg focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-fg-subtle">Ничего не найдено</div>
              ) : (
                filtered.slice(0, 200).map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => pick(o.value)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-surface-hover",
                      o.value === value ? "font-medium text-accent-fg" : "text-fg",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                  </button>
                ))
              )}
            </div>
            {extraOption && (
              <button
                type="button"
                onClick={() => pick(extraOption.value)}
                className="block w-full border-t border-line-soft px-3 py-2 text-left text-[13px] font-medium text-accent hover:bg-surface-hover"
              >
                {extraOption.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
