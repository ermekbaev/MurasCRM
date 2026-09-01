import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { generateUploadUrl } from "@/lib/s3";
import { randomUUID } from "crypto";
import { z } from "zod";

const schema = z.object({
  fileName: z.string().min(1),
});

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Ссылка для загрузки DOCX-бланка шаблона в хранилище. */
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!["ADMIN", "MANAGER", "ACCOUNTANT"].includes(session.user.role)) {
    return apiError.forbidden();
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError.badRequest(parsed.error.flatten());

  if (!parsed.data.fileName.toLowerCase().endsWith(".docx")) {
    return apiError.badRequest("Шаблон должен быть файлом .docx");
  }

  const key = `templates/${randomUUID()}.docx`;
  const uploadUrl = await generateUploadUrl(key, DOCX_MIME).catch(() => null);
  if (!uploadUrl) {
    return NextResponse.json(
      { error: "Хранилище недоступно — файл загрузить не удалось" },
      { status: 503 },
    );
  }

  return NextResponse.json({ key, uploadUrl, contentType: DOCX_MIME });
}
