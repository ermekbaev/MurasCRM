// Long-polling для Telegram-бота.
//
// Зачем: на некоторых серверах входящие подключения от Telegram к вебхуку не
// проходят («Connection timed out»), хотя исходящие с сервера к Telegram
// работают. Тогда вместо вебхука сервер сам забирает обновления (getUpdates) и
// прогоняет каждое через тот же обработчик /api/telegram/webhook на localhost —
// вся логика остаётся одна.
//
// Запуск под PM2 (из каталога приложения, с .env в окружении):
//   pm2 start scripts/telegram-poller.mjs --name tg-poller
// Токен и секрет читаются из CompanySettings на каждом цикле — смена из UI
// подхватывается без перезапуска.

import pg from "pg";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const DB_URL = (process.env.DATABASE_URL || "").split("?")[0];

const pool = new pg.Pool({ connectionString: DB_URL });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getConfig() {
  try {
    const r = await pool.query('SELECT "telegramBotToken", "telegramSecret" FROM "CompanySettings" LIMIT 1');
    return r.rows[0] || {};
  } catch {
    return {};
  }
}

async function tg(token, method, params = "") {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}${params}`);
  return res.json();
}

let offset = 0;
let webhookCleared = null; // токен, для которого уже сняли вебхук

async function main() {
  console.log("[tg-poller] старт, APP_URL=" + APP_URL);
  for (;;) {
    const { telegramBotToken: token, telegramSecret: secret } = await getConfig();
    if (!token) {
      await sleep(5000);
      continue;
    }
    // getUpdates не работает, пока установлен вебхук — снимаем его один раз.
    if (webhookCleared !== token) {
      await tg(token, "deleteWebhook", "?drop_pending_updates=false").catch(() => {});
      webhookCleared = token;
      console.log("[tg-poller] вебхук снят, перешли на long-polling");
    }
    try {
      const data = await tg(
        token,
        "getUpdates",
        `?timeout=30&offset=${offset}&allowed_updates=${encodeURIComponent('["message","edited_message"]')}`,
      );
      if (data && data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          await fetch(`${APP_URL}/api/telegram/webhook`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(secret ? { "X-Telegram-Bot-Api-Secret-Token": secret } : {}),
            },
            body: JSON.stringify(update),
          }).catch((e) => console.log("[tg-poller] forward error", e?.message));
        }
      } else if (data && !data.ok) {
        console.log("[tg-poller] getUpdates !ok:", data.description);
        await sleep(3000);
      }
    } catch (e) {
      console.log("[tg-poller] loop error:", e?.message);
      await sleep(3000);
    }
  }
}

main();
