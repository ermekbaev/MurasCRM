/**
 * Подключение вебхука Telegram.
 *
 * Запуск:
 *   node scripts/setup-telegram-webhook.mjs https://dass.muras-brand.kg
 *
 * Берёт TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET из .env проекта.
 * Секрет обязателен: без него точка приёма отвечает 503, потому что писать
 * в неё иначе смог бы кто угодно.
 */
import { readFileSync } from "fs";

function env() {
  const out = {};
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* .env может отсутствовать — тогда берём из окружения */
  }
  return { ...out, ...process.env };
}

const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: secret } = env();
const base = process.argv[2];

if (!token) {
  console.error("Нет TELEGRAM_BOT_TOKEN");
  process.exit(1);
}
if (!secret) {
  console.error("Нет TELEGRAM_WEBHOOK_SECRET — задайте его в .env");
  process.exit(1);
}
if (!base) {
  console.error("Укажите адрес сайта: node scripts/setup-telegram-webhook.mjs https://example.com");
  process.exit(1);
}

const url = `${base.replace(/\/$/, "")}/api/telegram/webhook`;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url,
    secret_token: secret,
    // Нас интересуют только сообщения: остальные события шумят зря.
    // business_* — переписка личного аккаунта через Telegram Business. Пока
    // никто не подключён, но включаем сразу: иначе при подключении пришлось бы
    // переустанавливать вебхук и вспоминать, почему сообщений нет.
    allowed_updates: [
      "message",
      "edited_message",
      "business_connection",
      "business_message",
      "edited_business_message",
    ],
    drop_pending_updates: true,
  }),
});

const body = await res.json();
console.log(body.ok ? `Вебхук подключён: ${url}` : `Ошибка: ${body.description}`);

const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json());
console.log("Текущее состояние:", JSON.stringify(info.result, null, 2));
