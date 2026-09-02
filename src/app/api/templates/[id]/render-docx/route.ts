import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/s3";
import { buildTemplateVars, buildTemplateRows } from "@/lib/templateVars.server";
import { swapTemplateImages, type SlotImage } from "@/lib/docxImages";
import { DOCUMENT_VAR_KEYS } from "@/lib/documentVars";
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

  const { orderId, invoiceId, clientId, withStamp, format } = await req
    .json()
    .catch(() => ({}));

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
      // Известная переменная без данных в этом контексте (например, номер
      // счёта, когда документ делают из заявки) — просто пусто. Видимой
      // оставляем только незнакомую: это опечатка в шаблоне.
      nullGetter: (part: { value?: string }) => {
        const key = part.value;
        if (!key) return "";
        return DOCUMENT_VAR_KEYS.includes(key) ? "" : `{${key}}`;
      },
    });

    // Флаги для условных блоков в бланке: {#has_vat}…{/has_vat}.
    // docxtemplater покажет содержимое, только если значение истинно.
    const settings = await prisma.companySettings.findFirst();
    const flags = {
      has_vat: Boolean(settings?.worksWithVat),
      has_items: items.length > 0,
      has_stamp: Boolean(settings?.stampKey),
    };

    doc.render({ ...vars, ...flags, items });

    // Печать и подпись подставляем после заполнения текста: заглушки в
    // бланке помечены в «Замещающем тексте» словами stamp и signature.
    // Без галки они гасятся прозрачным пикселем — закрывающие документы
    // часто печатают и подписывают от руки.
    const slots: SlotImage[] = [];
    for (const [slot, key] of [
      ["stamp", settings?.stampKey],
      ["signature", settings?.signatureKey],
      // Логотип — часть бланка, а не подпись: ставим его всегда,
      // галка управляет только печатью и подписью.
      ["logo", settings?.logoKey],
    ] as const) {
      if ((slot !== "logo" && !withStamp) || !key) {
        slots.push({ slot, data: null, ext: null });
        continue;
      }
      const data = await getObjectBuffer(key).catch(() => null);
      slots.push({
        slot,
        data,
        ext: key.split(".").pop()?.toLowerCase() ?? null,
      });
    }
    const swap = swapTemplateImages(doc.getZip(), slots);

    const out = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });

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
