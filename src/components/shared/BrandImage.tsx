import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Значок бренда установки. Свой логотип клиента показываем как есть; если его нет, рисуем нейтральный знак
 * в цвете акцента, а не логотип Muras-Brand (Адилет 22.11: «убираем везде логотипы мурас бренд»).
 */
export default function BrandImage({ src, alt, width, height, className, ...rest }: React.ComponentProps<typeof Image>) {
  if (src) return <Image src={src} alt={alt} width={width} height={height} className={className} {...rest} />;
  const w = Number(width) || 24;
  const h = Number(height) || w;
  const side = Math.min(w, h);
  return (
    <span
      role="img"
      aria-label={alt}
      className={cn("inline-grid shrink-0 place-items-center rounded-[28%] bg-accent text-on-accent", className?.replace(/max-w-\[[^\]]+\]|w-auto|object-\S+/g, ""))}
      style={{ width: side, height: side }}
    >
      {/* временный знак (22.11): два пика, «Ашуу» значит перевал; рисуется цветом надписи на акценте */}
      <svg viewBox="0 0 24 24" style={{ width: side * 0.66, height: side * 0.66 }} fill="currentColor" aria-hidden="true">
        <path d="M2 19 9.5 6.5 14 14l2.2-3.7L22 19z" />
      </svg>
    </span>
  );
}
