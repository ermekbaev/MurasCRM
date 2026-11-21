/**
 * Иллюстрация страницы входа (22.11): изометрический широкоформатный принтер с отпечатанным листом
 * и плавающие карточки этапов заявки. Цвета берутся из акцента клиента (--accent), поэтому у каждого
 * заказчика картинка в его цвете. Только SVG и CSS, картинок не грузим.
 */

const S = 38; // масштаб изометрии
const CX = 330;
const CY = 250;

// точка в изометрии: x вправо-вниз, y влево-вниз, z вверх
const P = (x: number, y: number, z: number): [number, number] => [
  CX + (x - y) * S * 0.866,
  CY + (x + y) * S * 0.5 - z * S,
];
const pts = (list: [number, number][]) => list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");

/** Параллелепипед: верх, левая и правая грани своими цветами. */
function Box({
  x, y, z, w, d, h, top, left, right, stroke = "rgb(255 255 255 / .55)",
}: {
  x: number; y: number; z: number; w: number; d: number; h: number; top: string; left: string; right: string; stroke?: string;
}) {
  return (
    <g strokeLinejoin="round" stroke={stroke} strokeWidth={1}>
      <polygon points={pts([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)])} fill={left} />
      <polygon points={pts([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)])} fill={right} />
      <polygon points={pts([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)])} fill={top} />
    </g>
  );
}

export default function LoginArt({ stages, bare = false }: { stages?: { title: string; note: string }[]; bare?: boolean }) {
  // bare: только принтер, без карточек и пустых полей вокруг (шапка дашборда)
  const cards = stages ?? [
    { title: "Макет принят", note: "Начало точной работы" },
    { title: "В производстве", note: "Каждый этап под контролем" },
    { title: "Готов к выдаче", note: "Клиент уведомлён" },
  ];
  const accent = "var(--accent)";
  return (
    <div className={bare ? "relative h-full aspect-[400/290] select-none" : "relative mx-auto aspect-[660/520] w-full max-w-[660px] select-none"} aria-hidden="true">
      <svg viewBox={bare ? "130 120 400 290" : "0 0 660 520"} className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="la-slab" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgb(255 255 255 / .95)" />
            <stop offset="1" stopColor="var(--accent-soft-strong)" />
          </linearGradient>
          <filter id="la-shadow" x="-20%" y="-20%" width="140%" height="160%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        {/* тень под площадкой */}
        <ellipse cx="330" cy="420" rx="230" ry="46" fill="var(--accent)" opacity=".16" filter="url(#la-shadow)" />

        {/* площадка */}
        <Box x={-4} y={-3} z={0} w={8} d={6} h={0.5} top="url(#la-slab)" left="var(--accent-soft-strong)" right="var(--accent-soft)" />

        {/* стол принтера */}
        <Box x={-3} y={-1.4} z={0.5} w={6} d={2.8} h={0.7} top="#ffffff" left="var(--accent-soft)" right="var(--accent-soft-strong)" />

        {/* отпечатанный лист, выходит вперёд */}
        <polygon points={pts([P(-2.2, 1.4, 1.2), P(2.2, 1.4, 1.2), P(2.6, 3.1, 0.55), P(-1.8, 3.1, 0.55)])} fill="#fff" stroke="rgb(255 255 255 / .9)" />
        <polygon points={pts([P(-1.6, 1.8, 1.1), P(1.2, 1.8, 1.1), P(1.5, 2.9, 0.62), P(-1.3, 2.9, 0.62)])} fill={accent} opacity=".92" />
        <polygon points={pts([P(-0.9, 2.0, 1.0), P(0.5, 2.0, 1.0), P(0.7, 2.7, 0.68), P(-0.7, 2.7, 0.68)])} fill="#fff" opacity=".85" />

        {/* корпус принтера */}
        <Box x={-3.2} y={-1.6} z={1.2} w={6.4} d={1.6} h={1.9} top="var(--accent-soft)" left={accent} right="var(--accent-hover)" stroke="rgb(255 255 255 / .35)" />
        {/* верхняя крышка */}
        <Box x={-3.0} y={-1.5} z={3.1} w={6.0} d={1.4} h={0.45} top="#ffffff" left="var(--accent-soft-strong)" right="var(--accent-soft)" />
        {/* окно и индикаторы на лицевой грани */}
        <polygon points={pts([P(-2.5, 0, 1.55), P(1.2, 0, 1.55), P(1.2, 0, 2.6), P(-2.5, 0, 2.6)])} fill="rgb(255 255 255 / .22)" />
        <circle cx={P(2.1, 0, 2.2)[0]} cy={P(2.1, 0, 2.2)[1]} r="5" fill="#fff" opacity=".95" />
        <circle cx={P(2.55, 0, 2.2)[0]} cy={P(2.55, 0, 2.2)[1]} r="5" fill="#fff" opacity=".5" />

        {/* рулон материала сверху */}
        <ellipse cx={P(-1.2, -0.8, 3.9)[0]} cy={P(-1.2, -0.8, 3.9)[1]} rx="26" ry="13" fill="#fff" stroke="var(--accent)" strokeOpacity=".35" />
        <ellipse cx={P(-1.2, -0.8, 3.9)[0]} cy={P(-1.2, -0.8, 3.9)[1]} rx="9" ry="4.5" fill="var(--accent-soft-strong)" />

        {/* точечные узлы фона */}
        {[[70, 90], [120, 360], [560, 120], [600, 330], [250, 40], [470, 470]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 ? 4 : 6} fill="var(--accent)" opacity=".18" />
        ))}
        <path d="M70 90 L250 40 M120 360 L250 40 M560 120 L470 470 M600 330 L560 120" stroke="var(--accent)" strokeOpacity=".12" fill="none" />
      </svg>

      {/* плавающие карточки */}
      {!bare && <>
      <Card className="left-[1%] top-[22%]" title={cards[0].title} note={cards[0].note} bar={0.25} />
      <Card className="right-[0%] top-[8%]" title={cards[1].title} note={cards[1].note} bar={0.62} />
      <Card className="bottom-[2%] right-[6%]" title={cards[2].title} note={cards[2].note} check />
      </>}
    </div>
  );
}

function Card({ className, title, note, bar, check }: { className: string; title: string; note: string; bar?: number; check?: boolean }) {
  return (
    <div className={`absolute ${className} w-[34%] min-w-[150px] rounded-2xl border border-white/80 bg-white/90 p-3 shadow-[0_10px_30px_-12px_rgb(16_20_28/0.25)] backdrop-blur`}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          {check ? (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></svg>
          )}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold text-slate-800">{title}</div>
          <div className="truncate text-[10.5px] text-slate-500">{note}</div>
        </div>
      </div>
      {bar !== undefined && (
        <div className="mt-2.5 h-1 rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-accent" style={{ width: `${bar * 100}%` }} />
        </div>
      )}
    </div>
  );
}
