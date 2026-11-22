import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getObjectWithType } from "@/lib/s3";

/**
 * Значок вкладки.
 *
 * Свой файл, если он загружен: у клиента обычно уже есть фавикон на сайте, и
 * вкладка CRM должна выглядеть так же — иначе в браузере рядом висят две
 * вкладки одной компании с разными значками.
 *
 * Если файла нет — наш знак. Логотип для этого не годится: у большинства он надпись с названием, вытянутая по горизонтали,
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
          "Cache-Control": "public, max-age=300",
        },
      });
    } catch {
      // Файл пропал из хранилища — не оставлять же вкладку без значка.
    }
  }

  // Своего значка нет: наш знак, буква C в красках CMY (как в логотипе внутри; Адилет 23.11). Без режимов
  // наложения, они во вкладке браузера не работают, поэтому слои с прозрачностью.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#fff"/><g fill="none" stroke-width="11"><path transform="translate(-3 -2)" d="M48 18.5A19 19 0 1 0 48 45.5" stroke="#1fc3dc" stroke-opacity=".85"/><path transform="translate(3 -1.5)" d="M48 18.5A19 19 0 1 0 48 45.5" stroke="#f0368f" stroke-opacity=".8"/><path transform="translate(0 3)" d="M48 18.5A19 19 0 1 0 48 45.5" stroke="#f5d90a" stroke-opacity=".85"/></g></svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300",
    },
  });
}
