/**
 * PDF для текстовых документов (договор, КП, письмо) — из готового текста
 * шаблона. Табличные бланки (счёт, акт, накладная) имеют свои генераторы:
 * у них фиксированная вёрстка, а здесь — свободный текст.
 *
 * Рендерим через html2canvas, как остальные документы: встроенные шрифты
 * jsPDF не умеют кириллицу.
 */

interface DocumentCompany {
  name?: string;
  inn?: string;
  legalAddress?: string;
  phone?: string;
  logoKey?: string | null;
}

async function loadImageBase64(key: string): Promise<string | null> {
  if (!key) return null;
  try {
    const url = key.startsWith("http") ? key : `/api/files/view?key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Собирает страницу документа в отдельном контейнере вне экрана. */
async function buildContainer(
  title: string,
  body: string,
  company: DocumentCompany | null,
): Promise<HTMLDivElement> {
  const logoB64 = company?.logoKey ? await loadImageBase64(company.logoKey) : null;

  const header = [
    company?.name,
    company?.inn ? `ИНН ${company.inn}` : "",
    company?.legalAddress,
    company?.phone ? `тел.: ${company.phone}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const container = document.createElement("div");
  container.style.cssText = [
    "position:fixed",
    "top:-9999px",
    "left:-9999px",
    "width:794px",
    "background:white",
    "font-family:Arial,Helvetica,sans-serif",
  ].join(";");

  container.innerHTML = `
  <div style="padding:40px 44px;color:#111;">
    ${
      header || logoB64
        ? `<div style="display:flex;align-items:flex-start;gap:12px;border-bottom:1px solid #ddd;padding-bottom:12px;margin-bottom:24px;">
            ${logoB64 ? `<img src="${logoB64}" style="height:40px;object-fit:contain;" />` : ""}
            <div style="font-size:10px;color:#555;line-height:1.5;">${escapeHtml(header)}</div>
          </div>`
        : ""
    }
    <h1 style="font-size:17px;margin:0 0 20px 0;font-weight:700;text-align:center;">${escapeHtml(title)}</h1>
    <div style="font-size:12px;line-height:1.65;white-space:pre-wrap;word-wrap:break-word;">${escapeHtml(body)}</div>
  </div>`;

  return container;
}

/** Готовит PDF документа и возвращает его как Blob (для загрузки в файлы заявки). */
export async function buildDocumentPDFBlob(
  title: string,
  body: string,
  company: DocumentCompany | null,
): Promise<Blob> {
  const container = await buildContainer(title, body, company);
  document.body.appendChild(container);
  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;

    if (imgH <= pageH) {
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, imgH);
    } else {
      // Длинный договор не влезает на страницу — режем полотно постранично.
      const pxPerPage = (canvas.width * pageH) / pageW;
      let offsetPx = 0;
      while (offsetPx < canvas.height) {
        const sliceH = Math.min(pxPerPage, canvas.height - offsetPx);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        sliceCanvas.getContext("2d")!.drawImage(canvas, 0, -offsetPx);
        if (offsetPx > 0) pdf.addPage();
        pdf.addImage(
          sliceCanvas.toDataURL("image/png"),
          "PNG",
          0,
          0,
          pageW,
          (sliceH * pageW) / canvas.width,
        );
        offsetPx += pxPerPage;
      }
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(container);
  }
}

/** Скачивает документ как PDF. */
export async function downloadDocumentPDF(
  title: string,
  body: string,
  company: DocumentCompany | null,
  fileName?: string,
) {
  const blob = await buildDocumentPDFBlob(title, body, company);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || `${title}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
