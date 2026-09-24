import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { buildBrandPalette, isHexColor, type AccentPalette } from "@/lib/brand-palette";

/** Наши значения по умолчанию — то, как система выглядит без настройки. */
export const DEFAULT_BRAND = {
  name: "Muras-Brand",
  tagline: "CRM производства",
  color: "#7c3aed",
  logo: "/logo.svg",
};

export interface Branding {
  name: string;
  tagline: string;
  color: string;
  /** Путь к значку: свой из хранилища или наш по умолчанию. */
  logo: string;
  /** Пустая строка, если цвет не задан — тогда действует палитра из globals.css. */
  css: string;
  /** Установку настроили под клиента: свой цвет или своё название. */
  configured: boolean;
}

/**
 * Внешний вид установки.
 *
 * Читается на каждый запрос страницы, поэтому обёрнут в cache: в одном запросе
 * к базе сходим один раз, сколько бы мест ни спросило.
 */
export const getBranding = cache(async (): Promise<Branding> => {
  const settings = await prisma.companySettings
    .findFirst({
      select: {
        brandColor: true,
        brandName: true,
        brandTagline: true,
        interfaceLogoKey: true,
      },
    })
    .catch(() => null);

  const color =
    settings?.brandColor && isHexColor(settings.brandColor)
      ? settings.brandColor
      : DEFAULT_BRAND.color;

  const configured = Boolean(
    (settings?.brandColor && isHexColor(settings.brandColor)) || settings?.brandName?.trim(),
  );

  return {
    configured,
    name: settings?.brandName?.trim() || DEFAULT_BRAND.name,
    tagline: settings?.brandTagline?.trim() || DEFAULT_BRAND.tagline,
    color,
    logo: settings?.interfaceLogoKey ? "/api/branding/logo" : DEFAULT_BRAND.logo,
    css: color === DEFAULT_BRAND.color ? "" : paletteCss(color),
  };
});

/**
 * Переопределение переменных темы.
 *
 * Отдаётся как есть в теге style в разметке страницы, поэтому собирается из
 * вычисленных значений, а не из пользовательского ввода: в CSS попадают только
 * hex-строки, которые вернул генератор палитры.
 *
 * Тёмная тема в системе включается классом .dark на html — тем же селектором
 * пользуемся и здесь, иначе переключатель темы перестал бы менять акцент.
 *
 * Селекторы намеренно с запасом по весу (html:root против :root в globals.css):
 * так переопределение выигрывает независимо от того, в каком порядке браузер
 * склеит стили.
 */
export function paletteCss(brandHex: string): string {
  const p = buildBrandPalette(brandHex);
  const vars = (a: AccentPalette, neutrals: Record<string, string>) =>
    [
      `--accent:${a.accent}`,
      `--accent-hover:${a.accentHover}`,
      `--accent-active:${a.accentActive}`,
      `--accent-soft:${a.accentSoft}`,
      `--accent-soft-strong:${a.accentSoftStrong}`,
      `--accent-on-soft:${a.accentOnSoft}`,
      `--accent-ring:${a.accentRing}`,
      `--on-accent:${a.accentFg}`,
      // Фон и текст тоже в тоне бренда: наши «серые» на самом деле
      // сине-серые, и с тёплым акцентом они спорят.
      ...Object.entries(neutrals).map(([name, value]) => `--${name}:${value}`),
    ].join(";");

  return (
    `html:root{${vars(p.light, p.neutrals.light)}}` +
    `html:root.dark{${vars(p.dark, p.neutrals.dark)}}`
  );
}
