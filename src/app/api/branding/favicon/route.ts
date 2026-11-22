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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke-width="13"><path transform="translate(-4 -3)" d="M52 17A25 25 0 1 0 52 47" stroke="#1fc3dc"/><path transform="translate(4 -2)" d="M52 17A25 25 0 1 0 52 47" stroke="#f0368f" stroke-opacity=".9"/><path transform="translate(0 4)" d="M52 17A25 25 0 1 0 52 47" stroke="#f5d90a" stroke-opacity=".9"/></g></svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300",
    },
  });
}
