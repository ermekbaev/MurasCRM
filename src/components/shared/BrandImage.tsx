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
 * Логотип-слово (Адилет 23.11: «всё слово CRM в такие цвета»): первое слово названия печатается тремя слоями
 * CMY со сдвигом, как оттиск на плохой приводке; остальные слова мелко капсом справа. На светлой теме слои
 * перемножаются, на тёмной складываются. Фавикон остаётся буквой C (PrinterMark).
 */
export function BrandLockup({ name, tagline, size = 26 }: { name: string; tagline?: string; size?: number }) {
  const words = name.trim().split(/\s+/);
  const head = words[0] || "";
  const rest = words.slice(1).join(" ") || tagline || "";
  const o = Math.max(1.4, size / 16);
  // Светлая тема: слои перемножаются. Тёмная: голубой и малиновый остаются каёмкой, верхний слой белый (иначе всё складывается в белый).
  const layer = (cls: string, dx: number, dy: number, flow: boolean) => (
    <span aria-hidden="true" className={`${cls} ${flow ? "" : "absolute left-0 top-0"}`} style={{ transform: `translate(${dx * o}px, ${dy * o}px)` }}>
      {head}
    </span>
  );
  return (
    <span className="flex min-w-0 items-center" aria-label={name} role="img">
      <span className="relative inline-block font-extrabold tracking-tight" style={{ fontSize: size, lineHeight: 1, isolation: "isolate" }}>
        {layer("text-[#1fc3dc] mix-blend-multiply dark:mix-blend-normal", -1, -0.7, true)}
        {layer("text-[#f0368f] mix-blend-multiply dark:mix-blend-normal", 1, -0.4, false)}
        {layer("text-[#f5d90a] mix-blend-multiply dark:mix-blend-normal", 0, 1, false)}
        {/* тёмная тема: белый слой сверху, чтобы слово читалось, а каёмка CMY (включая жёлтую снизу) осталась по краям */}
        {layer("hidden text-white dark:block", 0, 0, false)}
      </span>
      {rest && (
        <span className="ml-3 min-w-0 truncate border-l border-line pl-3 text-[9.5px] font-semibold uppercase leading-[1.25] tracking-[0.16em] text-fg-subtle">{rest}</span>
      )}
    </span>
  );
}
