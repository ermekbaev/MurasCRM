/**
 * Проверка подключения WhatsApp Cloud API.
 *
 * Запуск из каталога стенда:
 *   node scripts/check-whatsapp.mjs https://dass.muras-brand.kg
 *
 * Вебхук у WhatsApp, в отличие от Telegram, не подключается запросом — адрес
 * вводится руками в панели Meta. Поэтому скрипт не настраивает, а проверяет:
 * что настройки на месте, токен живой и номер отвечает. И печатает то, что
 * нужно вставить в панель.
 */
import { readFileSync } from "fs";

function env() {
  const out = {};
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* .env может отсутствовать — тогда берём из окружения */
  }
  return { ...out, ...process.env };
}

const e = env();
const base = process.argv[2];

const missing = [
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
].filter((k) => !e[k]);

if (missing.length > 0) {
  console.error("Не заданы настройки:", missing.join(", "));
  process.exit(1);
}

const version = e.WHATSAPP_GRAPH_VERSION || "v21.0";
const res = await fetch(
  `https://graph.facebook.com/${version}/${e.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating`,
  { headers: { Authorization: `Bearer ${e.WHATSAPP_TOKEN}` } },
);
const body = await res.json();

if (!res.ok) {
  console.error("Meta отклонила запрос:", body?.error?.message ?? res.status);
  process.exit(1);
}

console.log("Номер:", body.display_phone_number);
console.log("Название:", body.verified_name);
console.log("Оценка качества:", body.quality_rating ?? "нет данных");

if (base) {
  console.log("");
  console.log("В панели Meta → WhatsApp → Configuration укажите:");
  console.log("  Callback URL:", `${base.replace(/\/$/, "")}/api/whatsapp/webhook`);
  console.log("  Verify token:", e.WHATSAPP_VERIFY_TOKEN);
  console.log("  Подписка на события: messages");
}
