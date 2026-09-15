import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/s3";

const DOCUMENT_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT"];

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Загруженный Word-бланк — обратно файлом, как его загрузили.
 *
 * Без этого бланк было не поправить: загрузил, увидел неточность в документе —
 * а исходника под рукой уже нет. Отдаём пустой бланк с переменными, не
 * заполненный: его и правят в Word.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!DOCUMENT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const { id } = await params;
  const template = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!template) return apiError.notFound();
  if (template.kind !== "DOCX" || !template.fileKey) {
    return apiError.badRequest("У шаблона нет загруженного файла .docx");
  }

  const file = await getObjectBuffer(template.fileKey).catch(() => null);
  if (!file) {
    return NextResponse.json({ error: "Файл шаблона недоступен в хранилище" }, { status: 502 });
  }

  const name = template.fileName || `${template.name}.docx`;
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
