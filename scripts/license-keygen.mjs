/**
 * Разовая генерация пары ключей для лицензий.
 *
 * Запускается ОДИН раз владельцем системы (продавцом), на своей машине.
 * Приватный ключ — мастер-ключ: им подписываются лицензии для всех клиентов.
 * Его нельзя коммитить, класть на сервер клиента или пересылать в переписке;
 * потеряешь — придётся перевыпускать все лицензии, утечёт — любой сможет
 * выписать себе бессрочную.
 *
 * Публичный ключ не секретный: он ставится в переменную LICENSE_PUBLIC_KEY на
 * сервере и только проверяет подпись, выписать ничего не может.
 *
 * Запуск:  node scripts/license-keygen.mjs
 */
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
const pubB64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");

const privPath = "license-private.pem";
if (existsSync(privPath)) {
  console.error(`\n⚠  ${privPath} уже существует — не перезаписываю. Убери его, если правда нужен новый ключ.\n`);
  process.exit(1);
}
writeFileSync(privPath, privPem, { mode: 0o600 });

console.log(`
Готово.

  Приватный ключ  →  ${privPath}
  Храни его вне репозитория и вне серверов. Им ты будешь выписывать лицензии.
  (${privPath} уже в .gitignore — проверь, что не закоммитил.)

  Публичный ключ — поставь на сервере в .env одной строкой:

LICENSE_PUBLIC_KEY=${pubB64}
`);
