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
  // наложения, они во вкладке браузера не работают, поэтому слои с прозрачностью. Цвета меняются по теме браузера (prefers-color-scheme): на светлой вкладке чуть темнее, на тёмной ярче.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><style>.c{stroke:#0aa5c2}.m{stroke:#d81b7a}.y{stroke:#e6b800}@media (prefers-color-scheme: dark){.c{stroke:#2bd0ea}.m{stroke:#ff4fa3}.y{stroke:#ffe53b}}</style><g fill="none" stroke-width="12"><path class="y" transform="translate(0 3.5)" d="M49.6 18.8A22 22 0 1 0 49.6 45.2"/><path class="c" transform="translate(-3.5 -2.5)" d="M49.6 18.8A22 22 0 1 0 49.6 45.2" stroke-opacity=".92"/><path class="m" transform="translate(3.5 -1.5)" d="M49.6 18.8A22 22 0 1 0 49.6 45.2" stroke-opacity=".85"/></g></svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300",
    },
  });
}
