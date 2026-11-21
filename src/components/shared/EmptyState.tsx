import { cn } from "@/lib/utils";

/**
 * Пустое состояние с иллюстрацией (22.11, Адилет: «добавив графику становится красиво, по всему проекту»).
 * Рисунки на SVG в акцентном цвете клиента (--accent), без картинок. kind выбирает сюжет.
 */
export type EmptyKind = "orders" | "money" | "clients" | "tasks" | "files" | "equipment" | "history" | "generic";

const Stroke = { fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Art({ kind }: { kind: EmptyKind }) {
  const soft = "var(--accent-soft-strong)";
  const acc = "var(--accent)";
  return (
    <svg viewBox="0 0 160 120" className="h-full w-full" aria-hidden="true">
      <ellipse cx="80" cy="104" rx="52" ry="8" fill={acc} opacity=".12" />
      <circle cx="80" cy="58" r="44" fill="var(--accent-soft)" />
      {kind === "orders" && (
        <g>
          <rect x="52" y="30" width="56" height="68" rx="8" fill="#fff" stroke={acc} strokeWidth="2" />
          <rect x="66" y="24" width="28" height="12" rx="5" fill={soft} stroke={acc} strokeWidth="2" />
          <path d="M62 52h36M62 64h36M62 76h22" stroke={soft} {...Stroke} strokeWidth="4" />
          <circle cx="104" cy="88" r="13" fill={acc} />
          <path d="M104 82v12M98 88h12" stroke="#fff" {...Stroke} strokeWidth="3" />
        </g>
      )}
      {kind === "money" && (
        <g>
          <ellipse cx="64" cy="86" rx="24" ry="8" fill={soft} stroke={acc} strokeWidth="2" />
          <path d="M40 86v-10c0 4 11 8 24 8s24-4 24-8v10" fill="#fff" stroke={acc} strokeWidth="2" />
          <ellipse cx="64" cy="76" rx="24" ry="8" fill="#fff" stroke={acc} strokeWidth="2" />
          <ellipse cx="64" cy="66" rx="24" ry="8" fill={soft} stroke={acc} strokeWidth="2" />
          <circle cx="104" cy="50" r="20" fill="#fff" stroke={acc} strokeWidth="2" />
          <path d="M104 40v20M98 46c0-4 12-4 12 0s-12 4-12 8 12 4 12 0" stroke={acc} {...Stroke} />
        </g>
      )}
      {kind === "clients" && (
        <g>
          <circle cx="80" cy="46" r="15" fill="#fff" stroke={acc} strokeWidth="2" />
          <path d="M52 94c0-16 12-26 28-26s28 10 28 26" fill="#fff" stroke={acc} strokeWidth="2" />
          <circle cx="46" cy="58" r="10" fill={soft} stroke={acc} strokeWidth="2" />
          <path d="M28 92c0-11 8-18 18-18" stroke={acc} {...Stroke} />
          <circle cx="114" cy="58" r="10" fill={soft} stroke={acc} strokeWidth="2" />
          <path d="M132 92c0-11-8-18-18-18" stroke={acc} {...Stroke} />
        </g>
      )}
      {kind === "tasks" && (
        <g>
          <rect x="46" y="28" width="68" height="70" rx="9" fill="#fff" stroke={acc} strokeWidth="2" />
          <path d="M58 48l5 5 9-10M58 68l5 5 9-10" stroke={acc} {...Stroke} strokeWidth="2.6" />
          <path d="M80 48h22M80 68h22M58 86h44" stroke={soft} {...Stroke} strokeWidth="4" />
        </g>
      )}
      {kind === "files" && (
        <g>
          <path d="M42 40a6 6 0 0 1 6-6h22l8 9h34a6 6 0 0 1 6 6v40a6 6 0 0 1-6 6H48a6 6 0 0 1-6-6z" fill="#fff" stroke={acc} strokeWidth="2" />
          <path d="M42 54h76" stroke={acc} strokeWidth="2" />
          <rect x="56" y="62" width="30" height="20" rx="3" fill={soft} />
          <circle cx="104" cy="74" r="9" fill={acc} />
          <path d="M104 69v10M99 74h10" stroke="#fff" {...Stroke} strokeWidth="2.6" />
        </g>
      )}
      {kind === "equipment" && (
        <g>
          <rect x="38" y="44" width="84" height="34" rx="7" fill="#fff" stroke={acc} strokeWidth="2" />
          <rect x="48" y="30" width="64" height="14" rx="4" fill={soft} stroke={acc} strokeWidth="2" />
          <rect x="54" y="78" width="52" height="14" rx="2" fill="#fff" stroke={acc} strokeWidth="2" />
          <path d="M60 85h40" stroke={soft} {...Stroke} strokeWidth="3" />
          <circle cx="108" cy="58" r="4" fill={acc} />
          <path d="M48 58h40" stroke={soft} {...Stroke} strokeWidth="4" />
        </g>
      )}
      {kind === "history" && (
        <g>
          <circle cx="80" cy="58" r="30" fill="#fff" stroke={acc} strokeWidth="2" />
          <path d="M80 40v18l12 8" stroke={acc} {...Stroke} strokeWidth="2.6" />
          <path d="M44 38l-2-12 12 2" stroke={soft} {...Stroke} strokeWidth="3" />
        </g>
      )}
      {kind === "generic" && (
        <g>
          <rect x="46" y="34" width="68" height="56" rx="9" fill="#fff" stroke={acc} strokeWidth="2" />
          <path d="M58 52h44M58 64h44M58 76h26" stroke={soft} {...Stroke} strokeWidth="4" />
        </g>
      )}
    </svg>
  );
}

export default function EmptyState({
  kind = "generic",
  title,
  hint,
  action,
  compact,
  className,
}: {
  kind?: EmptyKind;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  /** Меньше отступы и рисунок: для узких блоков и вкладок. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "py-5" : "py-10", className)}>
      <div className={compact ? "h-20 w-28" : "h-28 w-40"}>
        <Art kind={kind} />
      </div>
      <div className="mt-2 text-sm font-medium text-fg">{title}</div>
      {hint && <div className="mt-0.5 max-w-xs text-[13px] text-fg-subtle">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
