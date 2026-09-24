import { NextResponse } from "next/server";
import { getBranding, DEFAULT_BRAND } from "@/lib/branding.server";
import { buildBrandPalette } from "@/lib/brand-palette";

/**
 * Значок вкладки: буква на плашке фирменного цвета.
 *
 * Логотип для этого не годится. У большинства мастерских он — надпись с
 * названием, вытянутая по горизонтали; в квадрате 16×16 от неё остаётся
 * неразборчивая крошка. Буква на цветной плашке читается в любом размере и
 * сразу отличает вкладку клиента от соседних.
 *
 * Рисуется на лету, потому что зависит только от цвета и названия — хранить
 * ещё один файл и просить его у клиента незачем.
 */
export async function GET() {
  const brand = await getBranding();

  // Цвет буквы берём тот же, что и для надписи на кнопке: на светлом
  // фирменном цвете белая буква не читается.
  const palette = buildBrandPalette(brand.color);
  const letter = firstLetter(brand.name);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="${brand.color}"/>
<text x="32" y="33" fill="${palette.light.accentFg}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="38" font-weight="700" text-anchor="middle" dominant-baseline="central">${letter}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

/** Первая буква названия; экранируется — она попадает прямо в разметку SVG. */
function firstLetter(name: string): string {
  const ch = (name.trim() || DEFAULT_BRAND.name)[0].toUpperCase();
  return ch.replace(/[<>&"']/g, "");
}
