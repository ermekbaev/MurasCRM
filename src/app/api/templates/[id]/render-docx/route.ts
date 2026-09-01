import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/s3";
import { buildTemplateVars, buildTemplateRows } from "@/lib/templateVars.server";

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
  const { id } = await params;

  const template = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!template) return apiError.notFound();
  if (template.kind !== "DOCX" || !template.fileKey) {
    return apiError.badRequest("У шаблона нет загруженного файла .docx");
  }

  const { orderId, invoiceId, clientId } = await req.json().catch(() => ({}));

  const [vars, items, file] = await Promise.all([
    buildTemplateVars({ orderId, invoiceId, clientId }),
    buildTemplateRows({ orderId, invoiceId }),
    getObjectBuffer(template.fileKey).catch(() => null),
  ]);

  if (!file) {
    return NextResponse.json(
      { error: "Файл шаблона недоступен в хранилище" },
      { status: 502 },
    );
  }

  try {
    const [{ default: PizZip }, { default: Docxtemplater }] = await Promise.all([
      import("pizzip"),
      import("docxtemplater"),
    ]);

    const zip = new PizZip(file);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      // Переменную, которой нет в данных, оставляем видимой в документе —
      // так опечатка в шаблоне заметна сразу, а не превращается в пустоту.
      nullGetter: (part: { value?: string }) =>
        part.value ? `{${part.value}}` : "",
    });

    doc.render({ ...vars, items });

    const out = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
    const name = `${template.name}.docx`;

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": DOCX_MIME,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  } catch (e) {
    // Ошибки docxtemplater несут список проблемных мест — отдаём их человеку,
    // иначе непонятно, что именно в шаблоне не так.
    const err = e as { message?: string; properties?: { errors?: { properties?: { explanation?: string } }[] } };
    const details = err.properties?.errors
      ?.map((x) => x.properties?.explanation)
      .filter(Boolean)
      .join("; ");
    return NextResponse.json(
      { error: details || err.message || "Не удалось заполнить шаблон" },
      { status: 400 },
    );
  }
}
