/**
 * Разбор голосовой/текстовой команды из Telegram в структуру для CRM.
 *
 * Без ИИ: обычные правила. Поддержаны команды «задача …» и «клиент …».
 * Диктовка клавиатурой телефона приходит уже текстом — этого достаточно.
 * Даты и поля вытаскиваем по шаблонам; имя исполнителя отдаём подсказкой,
 * а сопоставление с сотрудником делает обработчик (ему доступен список).
 */

export type ParsedCommand =
  | { intent: "task"; title: string; assigneeHint: string | null; dueDate: string | null }
  | { intent: "client"; name: string; phone: string | null; inn: string | null; email: string | null }
  | { intent: "query"; query: "my_tasks" | "today_tasks" | "orders_in_progress" }
  | { intent: "help" }
  | { intent: "unknown"; text: string };

const MONTHS: Record<string, number> = {
  январ: 0, феврал: 1, март: 2, апрел: 3, ма: 4, июн: 5, июл: 6,
  август: 7, сентябр: 8, октябр: 9, ноябр: 10, декабр: 11,
};

// стем дня недели -> номер (0 = воскресенье, как getDay). Окончание любое
// (пятнице/пятницу/пятница), потому что склонения разные.
const WEEKDAYS: [RegExp, number][] = [
  [/воскресен[а-яё]*/i, 0],
  [/понедельник[а-яё]*/i, 1],
  [/вторник[а-яё]*/i, 2],
  [/сред[а-яё]+/i, 3],
  [/четверг[а-яё]*/i, 4],
  [/пятниц[а-яё]+/i, 5],
  [/суббот[а-яё]+/i, 6],
];

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Находит в тексте упоминание срока и возвращает ISO-дату и совпавшую строку
 * (чтобы вырезать её из заголовка). null, если срока нет.
 */
export function extractDate(text: string, now: Date = new Date()): { date: string; match: string } | null {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // сегодня / завтра / послезавтра (без \b — он не работает с кириллицей)
  let m = text.match(/(послезавтра|завтра|сегодня)/i);
  if (m) {
    const add = /послезавтра/i.test(m[1]) ? 2 : /завтра/i.test(m[1]) ? 1 : 0;
    const d = new Date(base);
    d.setDate(d.getDate() + add);
    return { date: iso(d), match: m[0] };
  }

  // через N дней/недель
  m = text.match(/через\s+(\d+)\s+(дн(?:я|ей|ь)|недел[юия])/i);
  if (m) {
    const n = parseInt(m[1], 10);
    const weeks = /недел/i.test(m[2]);
    const d = new Date(base);
    d.setDate(d.getDate() + (weeks ? n * 7 : n));
    return { date: iso(d), match: m[0] };
  }

  // к пятнице / до понедельника и т.п.
  for (const [re, dow] of WEEKDAYS) {
    m = text.match(re);
    if (m) {
      const diff = (dow - base.getDay() + 7) % 7 || 7; // ближайший будущий этот день
      const d = new Date(base);
      d.setDate(d.getDate() + diff);
      return { date: iso(d), match: m[0] };
    }
  }

  // к 5 октября / 5 октября
  m = text.match(/(\d{1,2})\s+([а-яё]+)/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const stem = Object.keys(MONTHS).find((s) => m![2].toLowerCase().startsWith(s));
    if (stem && day >= 1 && day <= 31) {
      const month = MONTHS[stem];
      let year = base.getFullYear();
      let d = new Date(year, month, day);
      if (d < base) { year += 1; d = new Date(year, month, day); }
      return { date: iso(d), match: m[0] };
    }
  }

  // до 05.10 / к 5.10.2026 / 05/10
  m = text.match(/(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    let year = m[3] ? parseInt(m[3], 10) : base.getFullYear();
    if (year < 100) year += 2000;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      let d = new Date(year, month, day);
      if (!m[3] && d < base) { d = new Date(year + 1, month, day); }
      return { date: iso(d), match: m[0] };
    }
  }

  return null;
}

/** Схлопывает пробелы и срезает разделители (запятые, тире) по краям. */
function cleanup(s: string): string {
  return s
    .replace(/\s{2,}/g, " ")
    .replace(/[\s,;:–—-]+$/g, "")
    .replace(/^[\s,;:–—-]+/g, "")
    .trim();
}

export function parseVoiceCommand(raw: string, now: Date = new Date()): ParsedCommand {
  const text = (raw || "").trim();
  if (!text) return { intent: "unknown", text: "" };

  if (/^\/?(help|start|помощь|команды|\?)(?=$|\s|[!.,])/i.test(text)) {
    return { intent: "help" };
  }

  // ── Запросы-отчёты (чтение) ─────────────────────────────────────────────────
  // Проверяем ДО создания задачи: «задачи на сегодня» иначе ушло бы в создание.
  // Шаблоны привязаны к концу строки, чтобы не ловить команды создания.
  if (/^(?:сколько\s+)?(?:заказ[а-яё]*|заяв[а-яё]*)\s+в\s+работе\s*\??$/i.test(text) ||
      /^сколько\s+(?:заказ[а-яё]*|заяв[а-яё]*)\s*\??$/i.test(text)) {
    return { intent: "query", query: "orders_in_progress" };
  }
  if (/^(?:какие\s+)?задач[а-яё]*\s+(?:на\s+)?сегодня\s*\??$/i.test(text) ||
      /^что\s+(?:у меня\s+)?(?:на\s+)?сегодня\s*\??$/i.test(text)) {
    return { intent: "query", query: "today_tasks" };
  }
  if (/^(?:какие\s+)?(?:мои|моих|мой)\s+задач[а-яё]*\s*\??$/i.test(text) ||
      /^(?:какие\s+)?задач[а-яё]*\s+у\s+меня\s*\??$/i.test(text)) {
    return { intent: "query", query: "my_tasks" };
  }

  // ── Клиент ─────────────────────────────────────────────────────────────────
  // \b с кириллицей не работает, поэтому конец ключевого слова ловим через
  // разделитель/конец строки.
  const clientHead = text.match(/^(?:нов(?:ый|ого)\s+)?(?:клиент|заказчик)(?:\s+|[:,-]\s*|$)/i);
  if (clientHead) {
    let rest = text.slice(clientHead[0].length);

    let email: string | null = null;
    let m = rest.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (m) { email = m[0]; rest = rest.replace(m[0], " "); }

    // 12 проверяем раньше 10, иначе из 12-значного возьмётся первые 10.
    let inn: string | null = null;
    m = rest.match(/инн[\s:]*(\d{12}|\d{10})(?!\d)/i);
    if (m) { inn = m[1]; rest = rest.replace(m[0], " "); }
    else {
      m = rest.match(/(?<!\d)(\d{12}|\d{10})(?!\d)/);
      if (m) { inn = m[1]; rest = rest.replace(m[0], " "); }
    }

    let phone: string | null = null;
    m = rest.match(/(?:тел(?:ефон)?|номер|моб(?:ильный)?)[\s:.]*(\+?[\d\-\s()]{6,}\d)/i);
    if (m) { phone = m[1].trim(); rest = rest.replace(m[0], " "); }
    else {
      m = rest.match(/\+?\d[\d\-\s()]{8,}\d/);
      if (m) { phone = m[0].trim(); rest = rest.replace(m[0], " "); }
    }

    // Остаточные слова-метки (без \b — кириллица): «почта», «телефон» и т.п.
    rest = rest.replace(/(телефон|тел|номер|моб(?:ильный)?|инн|почт[аеу]|е-?мейл|e-?mail|имя)[\s:.]*/gi, " ");
    const name = cleanup(rest);
    return { intent: "client", name, phone, inn, email };
  }

  // ── Задача ───────────────────────────────────────────────────────────────
  const taskHead = text.match(/^(?:задач[аиую]|задание|таск)(?:\s+|[:,-]\s*|$)/i);
  if (taskHead) {
    let rest = text.slice(taskHead[0].length);

    // Срок
    let dueDate: string | null = null;
    const dateHit = extractDate(rest, now);
    if (dateHit) {
      dueDate = dateHit.date;
      // вырезаем дату вместе с предлогом «к/до/на» перед ней
      const idx = rest.indexOf(dateHit.match);
      const before = rest.slice(0, idx).replace(/\s*(к|ко|до|на|к\s)\s*$/i, " ");
      rest = before + rest.slice(idx + dateHit.match.length);
    }

    // Исполнитель: «для Васи», «исполнитель Вася», «@vasya», «Васе:»
    let assigneeHint: string | null = null;
    const m = rest.match(/(?:для|исполнител[ьяю]|назначить(?:\s+на)?|@)\s*([A-Za-zА-Яа-яЁё]+)/i);
    if (m) { assigneeHint = m[1]; rest = rest.replace(m[0], " "); }

    const title = cleanup(rest);
    return { intent: "task", title, assigneeHint, dueDate };
  }

  return { intent: "unknown", text };
}
