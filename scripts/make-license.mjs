/**
 * Выписать лицензионный ключ.
 *
 * Запускается владельцем на своей машине, где лежит приватный ключ. Готовый
 * ключ отдаётся клиенту (или вставляется на странице активации) — им система
 * разблокируется до указанной даты.
 *
 * Запуск:
 *   node scripts/make-license.mjs "ДАСС" 2026-12-31
 *   node scripts/make-license.mjs "ДАСС" +30d           # на 30 дней от сегодня
 *
 * Приватный ключ берётся из файла license-private.pem рядом или из пути в
 * переменной LICENSE_PRIVATE_KEY_FILE.
 */
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const [org, when] = process.argv.slice(2);
if (!org || !when) {
  console.error('Использование: node scripts/make-license.mjs "Название" <ГГГГ-ММ-ДД | +Nd>');
  process.exit(1);
}

// Дата окончания: либо явная, либо «+Nd» дней от сегодня.
let exp;
const rel = when.match(/^\+(\d+)d$/);
if (rel) {
  const d = new Date();
  d.setDate(d.getDate() + Number(rel[1]));
  exp = d.toISOString().slice(0, 10);
} else if (/^\d{4}-\d{2}-\d{2}$/.test(when)) {
  exp = when;
} else {
  console.error("Дата: ГГГГ-ММ-ДД или +Nd (например +30d)");
  process.exit(1);
}

const keyFile = process.env.LICENSE_PRIVATE_KEY_FILE || "license-private.pem";
let privateKey;
try {
  privateKey = createPrivateKey(readFileSync(keyFile));
} catch {
  console.error(`Не нашёл приватный ключ: ${keyFile}. Сгенерируй его license-keygen.mjs.`);
  process.exit(1);
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const payload = b64url(JSON.stringify({ org, exp }));
const signature = b64url(sign(null, Buffer.from(payload), privateKey));
const key = `${payload}.${signature}`;

console.log(`
  Организация:  ${org}
  Действует до: ${exp}

  Ключ (отдать клиенту / вставить в «Активация»):

${key}
`);
