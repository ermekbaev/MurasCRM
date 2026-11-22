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
