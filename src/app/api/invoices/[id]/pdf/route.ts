import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/api";
import { respondWithPdf } from "@/lib/pdf-route.server";
import { defaultInvoiceTemplate, fillDocxTemplate, templateErrorText, TemplateFileMissingError } from "@/lib/fillTemplate.server";
import { docxToPdf, PdfUnavailableError } from "@/lib/docxToPdf.server";

const DOCUMENT_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT"];

/**
 * PDF счёта. Если загружен свой шаблон счёта «по умолчанию» (Word), счёт печатается по нему,
 * как в заявке, чтобы везде был один вид (Сергей из DASS 25.11). ?stamp=1 — с печатью и подписью.
 * Без своего шаблона — встроенная форма, как раньше.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tpl = await defaultInvoiceTemplate();
  if (tpl?.fileKey) {
    const session = await requireAuth();
    if (!session) return apiError.unauthorized();
    if (!DOCUMENT_ROLES.includes(session.user.role)) return apiError.forbidden();
    const invoice = await prisma.invoice.findUnique({ where: { id }, select: { number: true } });
    if (!invoice) return apiError.notFound();
    const withStamp = new URL(req.url).searchParams.get("stamp") === "1";
    try {
      const { out } = await fillDocxTemplate(tpl.fileKey, { invoiceId: id }, withStamp);
      const pdf = await docxToPdf(out, tpl.name);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`Счёт ${invoice.number}`)}.pdf`,
        },
      });
    } catch (e) {
      if (e instanceof TemplateFileMissingError) return NextResponse.json({ error: e.message }, { status: 502 });
      if (e instanceof PdfUnavailableError) return NextResponse.json({ error: e.message }, { status: 503 });
      return NextResponse.json({ error: templateErrorText(e) }, { status: 400 });
    }
  }

  return respondWithPdf(req, async () => {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { number: true },
    });
    if (!invoice) return null;

    return { path: `/invoices/${id}`, fileName: `Счёт ${invoice.number}` };
  });
}
