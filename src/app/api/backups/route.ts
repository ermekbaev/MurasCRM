import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { listObjects, generateDownloadUrl } from "@/lib/s3";

const PREFIX = "backups/";

/** Список резервных копий с ссылками на скачивание. Только администратор. */
export async function GET() {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (session.user.role !== "ADMIN") return apiError.forbidden();

  // хранилище копий недоступно (ключи S3 не подошли, нет сети): отвечаем понятной ошибкой, а не 500 (сквозная проверка 22.11)
  let listed;
  try {
    listed = await listObjects(PREFIX);
  } catch (e) {
    console.error("[backups] список копий:", e instanceof Error ? e.message : e);
    return NextResponse.json({ backups: [], error: "Хранилище копий недоступно. Проверьте ключи доступа к хранилищу в настройках сервера." });
  }
  const items = listed
    .sort((a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0))
    .slice(0, 100);

  const backups = await Promise.all(
    items.map(async (o) => ({
      key: o.key,
      name: o.key.slice(PREFIX.length),
      size: o.size,
      createdAt: o.lastModified?.toISOString() ?? null,
      // Ссылка живёт час — скачать успеют, а потом протухнет.
      url: await generateDownloadUrl(o.key, 3600).catch(() => null),
    })),
  );

  return NextResponse.json({ backups });
}
