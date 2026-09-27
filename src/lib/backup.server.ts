import { spawn } from "node:child_process";

/**
 * Дамп и восстановление базы через штатные pg_dump / pg_restore.
 *
 * Копии складываются в объектное хранилище (не на сам сервер): если сервер
 * потеряется целиком, копии останутся. Формат custom (-Fc) — сжатый и умеет
 * восстанавливаться выборочно.
 */

interface PgConn {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

/**
 * Разбирает DATABASE_URL в параметры подключения. Прокидывать URL напрямую в
 * pg_dump нельзя: Prisma добавляет `?schema=public`, а libpq на такой параметр
 * ругается. Поэтому берём части по отдельности.
 */
export function parseDbUrl(url: string): PgConn {
  const u = new URL(url);
  return {
    host: u.hostname || "localhost",
    port: u.port || "5432",
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "").split("?")[0],
  };
}

function baseArgs(c: PgConn): string[] {
  return ["-h", c.host, "-p", c.port, "-U", c.user, "-d", c.database];
}

/** Снять дамп базы в память (custom-формат). */
export function dumpDatabase(url: string, maxBytes = 200 * 1024 * 1024): Promise<Buffer> {
  const c = parseDbUrl(url);
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "pg_dump",
      [...baseArgs(c), "-Fc", "--no-owner", "--no-privileges"],
      { env: { ...process.env, PGPASSWORD: c.password } },
    );
    const chunks: Buffer[] = [];
    let size = 0;
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => {
      size += d.length;
      if (size > maxBytes) {
        proc.kill("SIGKILL");
        reject(new Error("Дамп превысил допустимый размер"));
        return;
      }
      chunks.push(d);
    });
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("error", (e) =>
      reject(new Error(`Не удалось запустить pg_dump: ${e.message}`)),
    );
    proc.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(chunks))
        : reject(new Error(stderr.trim() || `pg_dump завершился с кодом ${code}`)),
    );
  });
}

/**
 * Восстановить базу из дампа. --clean --if-exists сносит существующие объекты
 * и заливает заново; --no-owner, потому что владелец на другой установке иной.
 */
export function restoreDatabase(url: string, dump: Buffer): Promise<void> {
  const c = parseDbUrl(url);
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "pg_restore",
      [...baseArgs(c), "--clean", "--if-exists", "--no-owner", "--single-transaction"],
      { env: { ...process.env, PGPASSWORD: c.password } },
    );
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("error", (e) =>
      reject(new Error(`Не удалось запустить pg_restore: ${e.message}`)),
    );
    proc.on("close", (code) => {
      // pg_restore нередко возвращает код 1 на безобидных предупреждениях
      // (нечего удалять при --clean). Ошибкой считаем только реальный сбой.
      if (code === 0 || (code === 1 && !/error:/i.test(stderr))) resolve();
      else reject(new Error(stderr.trim() || `pg_restore завершился с кодом ${code}`));
    });
    proc.stdin.write(dump);
    proc.stdin.end();
  });
}
