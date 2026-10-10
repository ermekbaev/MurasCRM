// Разовый перенос клиентов из JSON в базу (миграция из Битрикса).
//
// Использование (из каталога приложения, с .env в окружении):
//   node scripts/import-clients.mjs <путь_к_clients.json> [--apply]
// Без --apply — только показывает, сколько создастся/пропустится (dry-run).
// Дедуп по ИНН (с существующими в базе и внутри файла). Помечает notes.

import pg from "pg";
import { readFileSync } from "fs";
import crypto from "crypto";

const [, , jsonPath, flag] = process.argv;
const APPLY = flag === "--apply";
if (!jsonPath) {
  console.error("Укажите путь к JSON");
  process.exit(1);
}

const DB = (process.env.DATABASE_URL || "").split("?")[0];
const MARK = "Импорт из Битрикса 2026-10-10";
const emailOk = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s || "");
const typeByInn = (inn) => (inn.length === 10 ? "LEGAL" : inn.length === 12 ? "IP" : "INDIVIDUAL");

const data = JSON.parse(readFileSync(jsonPath, "utf8"));
const pool = new pg.Pool({ connectionString: DB });

const ex = await pool.query('SELECT inn FROM "Client" WHERE inn IS NOT NULL AND inn <> \'\'');
const seen = new Set(ex.rows.map((r) => String(r.inn).trim()));

let created = 0, skipped = 0;
for (const c of data) {
  const inn = String(c.inn || "").trim();
  if (inn && seen.has(inn)) { skipped++; continue; }
  if (!c.name || !String(c.name).trim()) { skipped++; continue; }

  if (APPLY) {
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO "Client"
        (id,type,name,"fullName",inn,kpp,ogrn,okpo,phone,email,"legalAddress","bankName","bankBik","bankAccount","corrAccount",notes,source,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'OTHER',NOW(),NOW())`,
      [
        id, typeByInn(inn), String(c.name).trim(), c.fullName || null, inn || null,
        c.kpp || null, c.ogrn || null, c.okpo || null, c.phone || null,
        emailOk(c.email) ? c.email : null, c.legalAddress || null,
        c.bankName || null, c.bankBik || null, c.bankAccount || null, c.corrAccount || null, MARK,
      ],
    );
  }
  if (inn) seen.add(inn);
  created++;
}

console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", total: data.length, created, skipped }));
await pool.end();
