import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { putObject, listObjects, deleteObject } from "@/lib/s3";
import { dumpDatabase, parseDbUrl } from "@/lib/backup.server";

export const maxDuration = 120;

/** Сколько последних копий храним. Старые чистятся сами. */
const KEEP = 30;
const PREFIX = "backups/";

/**
 * Резервная копия базы в объектное хранилище.
 *
 * Дёргается двумя путями: по расписанию (крон, с секретом в заголовке) и
 * вручную из настроек (админом). Копии складываются не на сервер, а в бакет —
 * потеря сервера не уносит копии. Держим последние N, старые удаляем.
 */
async function runBackup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задан");

  const dump = await dumpDatabase(url);
  const db = parseDbUrl(url).database;
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const key = `${PREFIX}${db}-${stamp}.dump`;
  await putObject(key, dump, "application/octet-stream");

  // Чистим лишнее: оставляем последние KEEP по дате.
  const all = (await listObjects(PREFIX)).sort(
    (a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0),
  );
  let pruned = 0;
  for (const old of all.slice(KEEP)) {
    await deleteObject(old.key).catch(() => {});
    pruned++;
  }

  return { key, size: dump.length, pruned };
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runBackup()) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось сделать копию" },
      { status: 500 },
    );
  }
}

/** Ручной запуск из настроек — только администратором. */
export async function POST() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runBackup()) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось сделать копию" },
      { status: 500 },
    );
  }
}
