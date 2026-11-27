"use client";

import { useEffect, useRef, useState } from "react";
import { Archive } from "lucide-react";

/**
 * Через сколько выданные заявки уходят из канбана в архив (Сергей, DASS 27.11: «можно сразу, а можно через пару дней»).
 * Стоит прямо в заголовке колонки «Выдано», чтобы было видно, на что влияет. Менять может администратор,
 * остальные видят только подпись.
 */
export const ARCHIVE_OPTIONS = [
  { days: 0, label: "сразу" },
  { days: 1, label: "через 1 день" },
  { days: 3, label: "через 3 дня" },
  { days: 7, label: "через неделю" },
  { days: 14, label: "через 2 недели" },
  { days: 30, label: "через месяц" },
];

export const archiveLabel = (days: number) =>
  ARCHIVE_OPTIONS.find((o) => o.days === days)?.label ?? `через ${days} дн.`;

export default function ArchiveDaysPicker({
  days,
  canEdit,
  onChange,
}: {
  days: number;
  canEdit: boolean;
  onChange: (days: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  async function pick(next: number) {
    setOpen(false);
    if (next === days) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issuedArchiveDays: next }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setError("Не сохранилось");
      return;
    }
    onChange(next);
  }

  const text = `в архив ${archiveLabel(days)}`;
  if (!canEdit) return <span className="text-[11px] text-fg-subtle">{text}</span>;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        title="Когда выданные заявки уходят из канбана в архив"
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg disabled:opacity-60"
      >
        <Archive size={12} /> {saving ? "сохраняю…" : text} ▾
      </button>
      {error && <span className="absolute right-0 top-full mt-1 text-[11px] text-red-500">{error}</span>}
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg">
          <p className="px-3 pb-1 pt-1.5 text-[11px] text-fg-subtle">Выданные уходят в архив</p>
          {ARCHIVE_OPTIONS.map((o) => (
            <button
              key={o.days}
              type="button"
              onClick={() => pick(o.days)}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-surface-hover ${o.days === days ? "font-medium text-accent" : "text-fg"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
