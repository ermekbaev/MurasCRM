import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getObjectWithType } from "@/lib/s3";
import { getBranding, DEFAULT_BRAND } from "@/lib/branding.server";
import { buildBrandPalette } from "@/lib/brand-palette";

/**
 * Значок вкладки.
 *
 * Свой файл, если он загружен: у клиента обычно уже есть фавикон на сайте, и
 * вкладка CRM должна выглядеть так же — иначе в браузере рядом висят две
 * вкладки одной компании с разными значками.
 *
 * Если файла нет — рисуем букву на плашке фирменного цвета. Логотип для этого
 * не годится: у большинства он надпись с названием, вытянутая по горизонтали,
 * и в квадрате 16×16 от неё остаётся неразборчивая крошка.
 */
export async function GET() {
  const settings = await prisma.companySettings
    .findFirst({ select: { faviconKey: true } })
    .catch(() => null);

  if (settings?.faviconKey) {
    try {
      const { buffer, contentType } = await getObjectWithType(settings.faviconKey);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch {
      // Файл пропал из хранилища — не оставлять же вкладку без значка.
    }
  }

  const brand = await getBranding();
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
