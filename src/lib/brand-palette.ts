/**
 * Палитра акцента из одного фирменного цвета.
 *
 * У каждого клиента свой цвет: у нас фиолетовый, у «Дасс» оранжевый, у
 * следующего красный. Набором готовых пресетов это не закрыть, а отдать выбор
 * цвета как есть нельзя: акцент — это не один цвет, а семь значений в двух
 * темах, и подложка, посчитанная наивно, перестаёт читаться.
 *
 * Поэтому от клиента берётся только тон и насыщенность, а светлота каждой
 * роли — наша, выверенная. Считается в OKLCH: там светлота перцептивная, одно
 * и то же число одинаково выглядит и на фиолетовом, и на оранжевом. В HSL так
 * не выходит — формула, настроенная на одном тоне, на другом даёт грязь.
 *
 * Числа ниже сняты с нынешней палитры Muras, поэтому на #7c3aed генератор
 * возвращает ровно то, что было до него.
 */

export interface AccentPalette {
  accent: string;
  accentHover: string;
  accentActive: string;
  /** Цвет надписи на кнопке: белый или почти чёрный — что читается. */
  accentFg: string;
  accentSoft: string;
  accentSoftStrong: string;
  accentOnSoft: string;
  accentRing: string;
}

export interface BrandPalette {
  light: AccentPalette;
  dark: AccentPalette;
  /** Фон, поверхности и текст в тоне фирменного цвета. */
  neutrals: { light: NeutralPalette; dark: NeutralPalette };
  /** Контраст надписи на кнопке — ниже 4.5 текст не читается. */
  contrast: { light: number; dark: number };
  /** Пришлось ли двигать светлоту кнопки ради читаемости надписи. */
  adjusted: boolean;
}

interface Oklch {
  L: number;
  C: number;
  H: number;
}

/**
 * Потолки насыщенности и — для подложек — светлота.
 *
 * У кнопки и её состояний светлота своя, от фирменного цвета. А подложки и
 * надписи на них должны читаться одинаково у всех, поэтому их светлота
 * фиксирована, и от клиента берётся только тон.
 *
 * Потолки насыщенности сняты с исходной палитры: на низкой светлоте она
 * заметно мягче предельной, и без этого нажатая кнопка отдавала бы в ядовитый.
 */
const ROLES = {
  light: {
    accent: { C: 0.247 },
    accentHover: { C: 0.241 },
    accentActive: { C: 0.211 },
    accentSoft: { L: 0.958, C: 0.023 },
    accentSoftStrong: { L: 0.913, C: 0.048 },
    accentOnSoft: { L: 0.491, C: 0.241 },
  },
  dark: {
    accent: { C: 0.219 },
    accentHover: { C: 0.247 },
    accentActive: { C: 0.241 },
    accentSoft: { L: 0.257, C: 0.059 },
    accentSoftStrong: { L: 0.3, C: 0.077 },
    accentOnSoft: { L: 0.811, C: 0.101 },
  },
} as const;

/**
 * Светлота кнопки берётся у самого фирменного цвета — иначе оранжевый станет
 * жжёной охрой, а жёлтый оливковым, и клиент своего цвета не узнает. Рамки
 * нужны лишь по краям: почти белая кнопка потеряется на фоне, почти чёрная
 * перестанет быть акцентом.
 */
const ACCENT_L_RANGE = { min: 0.45, max: 0.82 };

/** В тёмной теме кнопка чуть светлее — так было и в исходной палитре. */
const DARK_L_OFFSET = 0.065;

/** Насколько наведение и нажатие темнее самой кнопки. */
const STATE_STEPS = { hover: 0.05, active: 0.109 };

/**
 * Нейтрали: фон, поверхности, линии, текст.
 *
 * Они только кажутся серыми. На деле у всех до единой тон 258–271 — холодный
 * синий, подобранный под наш фиолетовый: там расхождение 25–35°, и цвета
 * звучат вместе. С оранжевым акцентом (тон 39) расхождение под 220° — это
 * предел, и фон начинает спорить с акцентом.
 *
 * Поэтому тон нейтралей поворачиваем к фирменному, а светлоту и насыщенность
 * оставляем как есть. Насыщенность тут и так на уровне шёпота (не выше 0.028),
 * так что фон не красится, а лишь перестаёт быть холодным.
 *
 * Белый лист карточки остаётся чистым белым: подкрашенная бумага выглядит
 * несвежей.
 */
const NEUTRALS = {
  light: {
    canvas: { L: 0.970, C: 0.0041 },
    surface: { L: 1.0, C: 0 },
    "surface-sunken": { L: 0.979, C: 0.0029 },
    "surface-hover": { L: 0.964, C: 0.0058 },
    rail: { L: 0.989, C: 0.0026 },
    line: { L: 0.924, C: 0.0087 },
    "line-soft": { L: 0.952, C: 0.0058 },
    fg: { L: 0.217, C: 0.0151 },
    "fg-muted": { L: 0.568, C: 0.0284 },
    "fg-subtle": { L: 0.708, C: 0.0264 },
    "scrollbar-thumb": { L: 0.863, C: 0.0148 },
    "scrollbar-thumb-hover": { L: 0.708, C: 0.0264 },
  },
  dark: {
    canvas: { L: 0.173, C: 0.0134 },
    surface: { L: 0.217, C: 0.0151 },
    "surface-sunken": { L: 0.199, C: 0.0136 },
    "surface-hover": { L: 0.255, C: 0.0186 },
    rail: { L: 0.190, C: 0.0138 },
    line: { L: 0.292, C: 0.0202 },
    "line-soft": { L: 0.255, C: 0.0186 },
    fg: { L: 0.955, C: 0.0058 },
    "fg-muted": { L: 0.708, C: 0.0264 },
    "fg-subtle": { L: 0.568, C: 0.0284 },
    "scrollbar-thumb": { L: 0.315, C: 0.0220 },
    "scrollbar-thumb-hover": { L: 0.380, C: 0.0230 },
  },
} as const;

export type NeutralPalette = Record<string, string>;

const RING_ALPHA = { light: 0.35, dark: 0.45 };

/** Минимальный контраст белого текста на кнопке (WCAG AA). */
const MIN_CONTRAST = 4.5;

const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

const linearToSrgb = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

export function hexToOklch(hex: string): Oklch {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const [r, g, b] = [0, 2, 4].map((i) =>
    srgbToLinear(parseInt(full.slice(i, i + 2), 16) / 255),
  );

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C: Math.hypot(A, B), H };
}

/** Линейные компоненты sRGB; выход за [0,1] означает, что цвет вне охвата. */
function oklchToLinearRgb({ L, C, H }: Oklch): [number, number, number] {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

/**
 * OKLCH в hex с приведением в охват sRGB.
 *
 * Предельная насыщенность зависит от тона: на фиолетовом при той же светлоте
 * её куда больше, чем на жёлтом. Без приведения жёлтые и оранжевые цвета
 * обрезало бы по каналам и уводило в чужой тон, поэтому насыщенность
 * снижается до ближайшей, которая ещё помещается.
 */
export function oklchToHex(color: Oklch): string {
  let { C } = color;
  if (!inGamut(oklchToLinearRgb(color))) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinearRgb({ ...color, C: mid }))) lo = mid;
      else hi = mid;
    }
    C = lo;
  }

  const hex = oklchToLinearRgb({ ...color, C })
    .map((c) => {
      const v = Math.round(Math.min(1, Math.max(0, linearToSrgb(c))) * 255);
      return v.toString(16).padStart(2, "0");
    })
    .join("");
  return `#${hex}`;
}

/** Относительная яркость по WCAG. */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) =>
    srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Контраст двух цветов по WCAG. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Контраст с белым текстом. */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

function rgbaString(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * С какой светлоты фирменный цвет считается светлым.
 *
 * Ниже этой границы — красный, синий, фиолетовый: у них узнаваем тон, а
 * светлоту можно подвинуть на волосок, и белая надпись останется привычной.
 * Выше — оранжевый, жёлтый, бирюза: у них светлота и есть узнаваемость,
 * притемнишь — получишь охру вместо оранжевого. Там меняем надпись, а не цвет.
 */
const LIGHT_BRAND_L = 0.62;

/**
 * Надпись на кнопке: белая или почти чёрная.
 *
 * Белый плох не на всех цветах: у фирменного оранжевого с белым контраст 2.6,
 * а с тёмным — 6.9. Тёмный вариант — не чистый чёрный, а почти чёрный с тем же
 * тоном: на цветной кнопке он выглядит намеренным, а не забытым.
 */
function pickForeground(
  accent: string,
  brand: Oklch,
  allowInk: boolean,
): { fg: string; contrast: number } {
  const white = contrastWithWhite(accent);
  if (!allowInk) return { fg: "#ffffff", contrast: white };

  const ink = oklchToHex({ L: 0.18, C: Math.min(brand.C, 0.06), H: brand.H });
  const dark = contrast(accent, ink);
  return white >= dark ? { fg: "#ffffff", contrast: white } : { fg: ink, contrast: dark };
}

function buildTheme(
  brand: Oklch,
  theme: "light" | "dark",
): { palette: AccentPalette; contrast: number; adjusted: boolean } {
  const roles = ROLES[theme];
  const accentC = Math.min(brand.C, roles.accent.C);

  const base = clamp(brand.L, ACCENT_L_RANGE.min, ACCENT_L_RANGE.max);
  const start =
    theme === "dark" ? Math.min(base + DARK_L_OFFSET, ACCENT_L_RANGE.max) : base;

  // Обычно надпись читается сразу и двигать ничего не нужно. Не читается она
  // на узкой полосе средней светлоты, где и белый, и чёрный одинаково плохи, —
  // тогда уводим кнопку в ту сторону, где выигрывает выбранная надпись.
  const allowInk = brand.L >= LIGHT_BRAND_L;

  let L = start;
  let accent = oklchToHex({ L, C: accentC, H: brand.H });
  let fg = pickForeground(accent, brand, allowInk);
  for (let i = 0; i < 60 && fg.contrast < MIN_CONTRAST; i++) {
    const next = fg.fg === "#ffffff" ? L - 0.01 : L + 0.01;
    if (next < 0.2 || next > 0.95) break;
    L = next;
    accent = oklchToHex({ L, C: accentC, H: brand.H });
    fg = pickForeground(accent, brand, allowInk);
  }

  const stateAt = (step: number, cap: number) =>
    oklchToHex({
      L: Math.max(0.15, L - step),
      C: Math.min(brand.C, cap),
      H: brand.H,
    });

  const at = (role: { L: number; C: number }) =>
    oklchToHex({ L: role.L, C: Math.min(brand.C, role.C), H: brand.H });

  return {
    palette: {
      accent,
      accentHover: stateAt(STATE_STEPS.hover, roles.accentHover.C),
      accentActive: stateAt(STATE_STEPS.active, roles.accentActive.C),
      accentFg: fg.fg,
      accentSoft: at(roles.accentSoft),
      accentSoftStrong: at(roles.accentSoftStrong),
      accentOnSoft: at(roles.accentOnSoft),
      accentRing: rgbaString(accent, RING_ALPHA[theme]),
    },
    contrast: fg.contrast,
    adjusted: Math.abs(L - start) > 1e-6,
  };
}

/** Нейтрали в тоне фирменного цвета. */
function buildNeutrals(brand: Oklch, theme: "light" | "dark"): NeutralPalette {
  const out: NeutralPalette = {};
  for (const [name, role] of Object.entries(NEUTRALS[theme])) {
    out[name] =
      role.C === 0
        ? theme === "light"
          ? "#ffffff"
          : oklchToHex({ L: role.L, C: 0, H: brand.H })
        : oklchToHex({ L: role.L, C: role.C, H: brand.H });
  }
  return out;
}

/** Цвет из брендбука клиента — в полную палитру обеих тем. */
export function buildBrandPalette(brandHex: string): BrandPalette {
  const brand = hexToOklch(brandHex);
  const light = buildTheme(brand, "light");
  const dark = buildTheme(brand, "dark");
  return {
    light: light.palette,
    dark: dark.palette,
    neutrals: {
      light: buildNeutrals(brand, "light"),
      dark: buildNeutrals(brand, "dark"),
    },
    contrast: { light: light.contrast, dark: dark.contrast },
    adjusted: light.adjusted || dark.adjusted,
  };
}

/** Проверка значения из формы: #rgb или #rrggbb. */
export function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}
