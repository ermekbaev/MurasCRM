import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api";
import {
  renderPdf,
  siteOrigin,
  PdfRendererUnavailableError,
} from "@/lib/pdf-render.server";

/** Кто может выгружать документы — то же право, что и на их формирование. */
const DOCUMENT_ROLES = ["ADMIN", "MANAGER", "ACCOUNTANT"];

export interface PdfRequest {
  /** Путь страницы документа, например /waybills/abc?form=upd */
  path: string;
  /** Имя файла без расширения. */
  fileName: string;
  landscape?: boolean;
}

/**
 * Общая обвязка для выгрузки документа в PDF.
 *
 * Страницу печатает headless-браузер на сервере — см. pdf-render.server.
 * Здесь только права, адрес и понятная ошибка, если браузер не поднялся.
 */
export async function respondWithPdf(
  req: Request,
  build: () => Promise<PdfRequest | null>,
): Promise<Response> {
  const session = await requireAuth();
  if (!session) return apiError.unauthorized();
  if (!DOCUMENT_ROLES.includes(session.user.role)) return apiError.forbidden();

  const spec = await build();
  if (!spec) return apiError.notFound();

  const cookie = req.headers.get("cookie") ?? "";
  if (!cookie) return apiError.unauthorized();

  try {
    const pdf = await renderPdf({
      url: `${siteOrigin(req)}${spec.path}`,
      cookie,
      landscape: spec.landscape,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        // filename* — чтобы кириллица в имени не превращалась в мусор.
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          spec.fileName,
        )}.pdf`,
      },
    });
  } catch (e) {
    if (e instanceof PdfRendererUnavailableError) {
      return NextResponse.json(
        {
          error:
            "На сервере не настроено формирование PDF. Документ можно распечатать кнопкой «Печать».",
        },
        { status: 503 },
      );
    }
    console.error("pdf render", e);
    return NextResponse.json(
      { error: "Не удалось сформировать PDF. Попробуйте ещё раз." },
      { status: 500 },
    );
  }
}
