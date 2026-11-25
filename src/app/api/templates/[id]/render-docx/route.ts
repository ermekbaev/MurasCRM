import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { fillDocxTemplate, templateErrorText, TemplateFileMissingError } from "@/lib/fillTemplate.server";
import { docxToPdf, PdfUnavailableError } from "@/lib/docxToPdf.server";

const DOCUMENT_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT"];

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Заполняет загруженный DOCX-бланк данными заявки или счёта.
 *
 * Переменные в шаблоне пишутся как {client_name} — одинарные фигурные скобки,
 * так их понимает docxtemplater. Позиции вставляются циклом:
 *   {#items}{n} {name} {qty} {unit} {price} {total}{/items}
 * — цикл ставится на строку таблицы, и она размножается по числу позиций.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  // Заполненный бланк содержит реквизиты компании и клиента и суммы счёта.
  if (!DOCUMENT_ROLES.includes(session.user.role)) return apiError.forbidden();
  const { id } = await params;

  const template = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!template) return apiError.notFound();
  if (template.kind !== "DOCX" || !template.fileKey) {
    return apiError.badRequest("У шаблона нет загруженного файла .docx");
  }

  const { orderId, invoiceId, clientId, waybillId, withStamp, format } = await req
    .json()
    .catch(() => ({}));

  let out: Buffer;
  let swap: { skipped: { slot: string; reason: string }[] };
  try {
    const r = await fillDocxTemplate(template.fileKey, { orderId, invoiceId, clientId, waybillId }, Boolean(withStamp));
    out = r.out;
    swap = { skipped: r.skipped };
  } catch (e) {
    if (e instanceof TemplateFileMissingError) return NextResponse.json({ error: e.message }, { status: 502 });
    // Ошибки docxtemplater несут список проблемных мест — отдаём их человеку,
    // иначе непонятно, что именно в шаблоне не так.
    return NextResponse.json({ error: templateErrorText(e) }, { status: 400 });
  }

  {

    // PDF собирается из того же заполненного DOCX — вёрстка гарантированно
    // та же, что и в Word.
    if (format === "pdf") {
      try {
        const pdf = await docxToPdf(out, template.name);
        return new NextResponse(new Uint8Array(pdf), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(`${template.name}.pdf`)}`,
            ...(swap.skipped.length
              ? {
                  "X-Image-Warning": encodeURIComponent(
                    swap.skipped.map((x) => `${x.slot}: ${x.reason}`).join("; "),
                  ),
                }
              : {}),
          },
        });
      } catch (e) {
        // Не молчим и не подсовываем DOCX вместо PDF: человек просил PDF.
        const msg =
          e instanceof PdfUnavailableError
            ? e.message
            : "Не удалось собрать PDF — скачайте документ в Word";
        return NextResponse.json({ error: msg }, { status: 503 });
      }
    }

    const name = `${template.name}.docx`;

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": DOCX_MIME,
        // Клиент показывает это предупреждение: тело — сам файл, места для
        // структурированного ответа нет.
        ...(swap.skipped.length
          ? {
              "X-Image-Warning": encodeURIComponent(
                swap.skipped.map((x) => `${x.slot}: ${x.reason}`).join("; "),
              ),
            }
          : {}),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  }
}
