import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { putObject } from "@/lib/s3";
import { randomUUID } from "crypto";
import { DOCUMENT_VAR_KEYS } from "@/lib/documentVars";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MAX_BYTES = 10 * 1024 * 1024;

/** Служебные имена docxtemplater — это не переменные шаблона. */
const LOOP_KEYS = new Set([
  "items", "n", "name", "qty", "unit", "okei", "price", "total",
  "sum_no_vat", "vat", "discount",
  "has_vat", "has_items", "has_stamp", "logo", "stamp", "signature",
]);

/**
 * Загрузка DOCX-бланка через наш сервер.
 *
 * Раньше браузер клал файл прямо в хранилище по подписанной ссылке, но R2
 * отклоняет такие запросы без CORS-политики на бакете. Через сервер это
 * работает у любого клиента без настройки бакета — и заодно даёт проверить
 * файл до сохранения.
 */
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!["ADMIN", "ACCOUNTANT"].includes(session.user.role)) return apiError.forbidden();

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;
  if (!file) return apiError.badRequest("Файл не передан");

  if (!file.name.toLowerCase().endsWith(".docx")) {
    return apiError.badRequest("Шаблон должен быть файлом .docx");
  }
  if (file.size > MAX_BYTES) {
    return apiError.badRequest(
      `Файл больше ${MAX_BYTES / 1024 / 1024} МБ — для бланка это слишком много`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Проверяем шаблон до сохранения: битый архив или незакрытый цикл иначе
  // вылезли бы только при формировании документа, когда он уже нужен.
  let unknownVars: string[] = [];
  try {
    const [{ default: PizZip }, { default: Docxtemplater }] = await Promise.all([
      import("pizzip"),
      import("docxtemplater"),
    ]);

    const zip = new PizZip(buffer);
    if (!zip.file("word/document.xml")) {
      return apiError.badRequest("Это не документ Word — внутри нет word/document.xml");
    }

    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    const used: string[] = doc.getFullText().match(/\{([^}#/][^}]*)\}/g) ?? [];
    unknownVars = [
      ...new Set(
        used
          .map((v) => v.slice(1, -1).trim())
          .filter((v) => v && !LOOP_KEYS.has(v) && !DOCUMENT_VAR_KEYS.includes(v)),
      ),
    ];
  } catch (e) {
    const err = e as {
      message?: string;
      properties?: { errors?: { properties?: { explanation?: string } }[] };
    };
    const details = err.properties?.errors
      ?.map((x) => x.properties?.explanation)
      .filter(Boolean)
      .join("; ");
    return apiError.badRequest(
      details || err.message || "Файл повреждён или это не документ Word",
    );
  }

  const key = `templates/${randomUUID()}.docx`;
  try {
    await putObject(key, buffer, DOCX_MIME);
  } catch {
    return NextResponse.json(
      { error: "Хранилище недоступно — проверьте настройки S3" },
      { status: 502 },
    );
  }

  // Неизвестные переменные не повод отказать: человек мог оставить в бланке
  // свои пометки в фигурных скобках. Но предупредить надо.
  return NextResponse.json({ key, fileName: file.name, unknownVars });
}
