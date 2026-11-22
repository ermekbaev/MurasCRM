import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Значок бренда установки. Свой логотип клиента показываем как есть; если его нет, рисуем наш знак
 * в цвете акцента, а не логотип Muras-Brand (Адилет 22.11: «убираем везде логотипы мурас бренд»).
 * Знак (23.11): широкоформатный принтер с вышедшим оттиском и точками CMYK. Цвет фона и оттенков берётся
 * из акцента клиента, поэтому у каждой установки знак в её цвете.
 */
export function PrinterMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} role="img" aria-label="CRM" style={{ flexShrink: 0 }}>
      <rect width="64" height="64" rx="16" fill="var(--accent)" />
      {/* корпус и крышка */}
      <rect x="9" y="19" width="46" height="21" rx="5" fill="#ffffff" />
      <rect x="13" y="12" width="38" height="9" rx="3.5" fill="#ffffff" fillOpacity=".78" />
      {/* вал и щель подачи */}
      <rect x="9" y="35" width="46" height="5" rx="2.5" fill="var(--accent-active)" />
      <rect x="14" y="40.5" width="36" height="2" rx="1" fill="#000" fillOpacity=".28" />
      {/* панель: экран и индикаторы */}
      <rect x="38" y="24" width="12" height="6.5" rx="1.8" fill="var(--accent-active)" />
      <circle cx="15" cy="27.5" r="1.8" fill="var(--accent-active)" />
      <circle cx="20.5" cy="27.5" r="1.8" fill="var(--accent-active)" fillOpacity=".55" />
      {/* оттиск с точками CMYK */}
      <rect x="17" y="43" width="30" height="14" rx="1.8" fill="#ffffff" />
      <circle cx="24" cy="49.5" r="2.5" fill="#19b6e6" />
      <circle cx="31" cy="49.5" r="2.5" fill="#e6197a" />
      <circle cx="38" cy="49.5" r="2.5" fill="#ffd400" />
      <rect x="21" y="54" width="22" height="1.6" rx=".8" fill="#1a1a1a" fillOpacity=".7" />
    </svg>
  );
}

export default function BrandImage({ src, alt, width, height, className, ...rest }: React.ComponentProps<typeof Image>) {
  if (src) return <Image src={src} alt={alt} width={width} height={height} className={className} {...rest} />;
  const w = Number(width) || 24;
  const h = Number(height) || w;
  const side = Math.min(w, h);
  return <PrinterMark size={side} className={cn(className?.replace(/max-w-\[[^\]]+\]|w-auto|object-\S+/g, ""))} />;
}
