import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { getObjectBuffer } from "@/lib/s3";
import { restoreDatabase } from "@/lib/backup.server";
import { z } from "zod";

export const maxDuration = 120;

const schema = z.object({
  key: z.string().min(1).startsWith("backups/"),
  // Подтверждение словом: восстановление затирает текущие данные.
  confirm: z.literal("ВОССТАНОВИТЬ"),
});

/**
 * Восстановление базы из выбранной копии.
 *
 * Действие затирающее: текущее содержимое заменяется данными из копии. Поэтому
 * только администратор и только с явным подтверждением словом. Ключ принимается
 * лишь из папки backups/ — произвольный файл не подсунуть.
 */
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Нужен ключ копии и подтверждение словом ВОССТАНОВИТЬ" },
      { status: 400 },
    );
  }

  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "DATABASE_URL не задан" }, { status: 500 });

  try {
    const dump = await getObjectBuffer(parsed.data.key, 300 * 1024 * 1024);
    await restoreDatabase(url, dump);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Не удалось восстановить" },
      { status: 500 },
    );
  }
}
