import Image from "next/image";

/**
 * Знак по умолчанию (Адилет 23.11, вариант B): буква C тремя слоями краски CMY со сдвигом, как оттиск
 * на плохой приводке. На светлой теме слои перемножаются (в центре тёмный), на тёмной складываются (светлый).
 * Без плашки и без цвета бренда: знак всегда в красках печати, цвет клиента остаётся в интерфейсе.
 */
export function PrinterMark({ size = 40, className }: { size?: number; className?: string }) {
  const arc = (dx: number, dy: number, col: string) => (
    <path
      transform={`translate(${dx} ${dy})`}
      d="M48 18.5A19 19 0 1 0 48 45.5"
      fill="none"
      stroke={col}
      strokeWidth="11"
      className="mix-blend-multiply dark:mix-blend-screen"
    />
  );
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} role="img" aria-label="CRM" style={{ flexShrink: 0, isolation: "isolate" }}>
      {arc(-3, -2, "#1fc3dc")}
      {arc(3, -1.5, "#f0368f")}
      {arc(0, 3, "#f5d90a")}
    </svg>
  );
}

export default function BrandImage({ src, alt, width, height, className, ...rest }: React.ComponentProps<typeof Image>) {
  if (src) return <Image src={src} alt={alt} width={width} height={height} className={className} {...rest} />;
  // Без своего логотипа показываем наш знак
  const side = Math.min(Number(width) || 24, Number(height) || Number(width) || 24);
  return <PrinterMark size={side} />;
}

/**
 * Логотип с названием одной связкой (Адилет 23.11: «текст должен быть частью лого»). Если название начинается
 * с «C», эта буква и есть знак CMY, дальше идёт остаток слова крупно, а остальные слова мелко капсом под ним.
 * Иначе знак слева и название. Цвет текста берётся от родителя (text-fg).
 */
export function BrandLockup({ name, tagline, size = 30 }: { name: string; tagline?: string; size?: number }) {
  const words = name.trim().split(/\s+/);
  const head = words[0] || "";
  const rest = words.slice(1).join(" ") || tagline || "";
  const startsC = /^c/i.test(head);
  const big = startsC ? head.slice(1) : head;
  return (
    <span className="flex min-w-0 items-center" aria-label={name} role="img">
      <span className="flex items-end leading-none">
        {startsC ? <PrinterMark size={size} className="-mr-0.5" /> : <PrinterMark size={size} className="mr-2" />}
        <span className="pb-[3px] text-[24px] font-extrabold tracking-tight text-fg" style={{ lineHeight: 1 }}>{big}</span>
      </span>
      {rest && (
        <span className="ml-2.5 min-w-0 truncate border-l border-line pl-2.5 text-[9.5px] font-semibold uppercase leading-[1.25] tracking-[0.16em] text-fg-subtle">{rest}</span>
      )}
    </span>
  );
}
