import { useId } from "react";
import Image from "next/image";

/**
 * Знак по умолчанию (Адилет 23.11, вариант A из трёх): изометрический принтер в значке с объёмом.
 * Цвета корпуса и фона берутся из акцента установки, поэтому у каждого клиента знак в его цвете.
 * Рисуется изометрией (как иллюстрации на входе и в шапке), точки считаем в коде, картинок не грузим.
 */
const S = 9;
const CX = 32;
const CY = 40;
const P = (x: number, y: number, z: number): [number, number] => [CX + (x - y) * S * 0.866, CY + (x + y) * S * 0.5 - z * S];
const pts = (l: [number, number][]) => l.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");

function Box({ x, y, z, w, d, h, top, left, right }: { x: number; y: number; z: number; w: number; d: number; h: number; top: string; left: string; right: string }) {
  return (
    <>
      <polygon points={pts([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)])} fill={left} />
      <polygon points={pts([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)])} fill={right} />
      <polygon points={pts([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)])} fill={top} />
    </>
  );
}

export function PrinterMark({ size = 40, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const knob = P(-1.5, 0.2, 0.9);
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} role="img" aria-label="CRM" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-active)" />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent-active)" />
          <stop offset="1" stopColor="var(--accent-active)" stopOpacity=".78" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="var(--accent-soft)" />
      <rect x=".5" y=".5" width="63" height="63" rx="14.5" fill="none" stroke="var(--accent)" strokeOpacity=".22" />
      {/* площадка */}
      <Box x={-2.3} y={-1.6} z={0} w={4.6} d={3.2} h={0.35} top="#ffffff" left="#cfd9d4" right="#e3ebe7" />
      {/* лист с оттиском: голубая и малиновая полосы */}
      <polygon points={pts([P(-1.3, -0.6, 0.35), P(1.3, -0.6, 0.35), P(1.8, 1.7, 0.36), P(-1.8, 1.7, 0.36)])} fill="#fff" stroke="#b8c7bf" strokeWidth=".5" />
      <polygon points={pts([P(-0.9, 0.2, 0.37), P(0.9, 0.2, 0.37), P(1.2, 1.2, 0.37), P(-1.2, 1.2, 0.37)])} fill="#19b6e6" />
      <polygon points={pts([P(-0.9, 0.55, 0.38), P(0.9, 0.55, 0.38), P(1.05, 1.0, 0.38), P(-1.05, 1.0, 0.38)])} fill="#e6197a" />
      {/* корпус и крышка */}
      <Box x={-2} y={-1.7} z={0.35} w={4} d={1.9} h={1.6} top="#f4faf7" left={`url(#${id}l)`} right={`url(#${id}r)`} />
      <Box x={-1.6} y={-1.5} z={1.95} w={3.2} d={1.5} h={0.35} top="#ffffff" left="#d9e7e0" right="#c3d6cc" />
      <polygon points={pts([P(0.6, 0.2, 1.2), P(1.5, 0.2, 1.2), P(1.5, 0.2, 1.55), P(0.6, 0.2, 1.55)])} fill="#000" fillOpacity=".55" />
      <circle cx={knob[0]} cy={knob[1]} r="1" fill="#fff" fillOpacity=".9" />
    </svg>
  );
}

export default function BrandImage({ src, alt, width, height, className, ...rest }: React.ComponentProps<typeof Image>) {
  if (src) return <Image src={src} alt={alt} width={width} height={height} className={className} {...rest} />;
  // Без своего логотипа показываем наш знак
  const side = Math.min(Number(width) || 24, Number(height) || Number(width) || 24);
  return <PrinterMark size={side} />;
}
