/**
 * PDF из того документа, который человек видит на экране.
 *
 * Раньше у каждого документа было две вёрстки: React-компонент для экрана и
 * отдельная HTML-строка внутри *-pdf.ts для файла. Они разъехались — на экране
 * счёт по образцу заказчика, а в скачанном файле старая форма Muras. Иначе и
 * быть не могло: любое исправление нужно было помнить сделать дважды.
 *
 * Поэтому снимок берётся прямо с узла страницы. Источник правды один, разойтись
 * больше нечему.
 *
 * Шрифты остаются растровыми: встроенные шрифты jsPDF не умеют кириллицу, а
 * тащить в браузер полноценный шрифт ради счёта дороже, чем отрисовать картинку.
 */

/** A4 книжной ориентации в миллиметрах. */
const A4 = { width: 210, height: 297 };

/**
 * Разрешение снимка. Двойное даёт читаемый текст при печати и не раздувает
 * файл до неприличного размера.
 */
const SCALE = 2;

export interface CaptureOptions {
  /** Имя файла без расширения. */
  fileName: string;
  /** Альбомная ориентация — для ТОРГ-12 и УПД. */
  landscape?: boolean;
  /**
   * Ширина бланка на время снимка, в пикселях.
   *
   * Без неё документ снимается той ширины, какой он оказался в окне, и PDF у
   * человека с узким экраном выходит другим: колонки с жёсткой шириной
   * занимают в узком бланке большую долю. С фиксированной шириной файл всегда
   * одинаковый, независимо от размера окна.
   */
  fixedWidth?: number;
}

export async function captureToPdf(
  node: HTMLElement,
  { fileName, landscape = false, fixedWidth }: CaptureOptions,
): Promise<void> {
  const restore = fixedWidth ? applyFixedWidth(node, fixedWidth) : null;
  try {
    const pdf = await render(node, { landscape });
    pdf.save(`${fileName}.pdf`);
  } finally {
    restore?.();
  }
}

/** Задаёт ширину на время снимка и возвращает функцию отката. */
function applyFixedWidth(node: HTMLElement, width: number): () => void {
  const prevWidth = node.style.width;
  const prevMaxWidth = node.style.maxWidth;

  node.style.width = `${width}px`;
  node.style.maxWidth = "none";

  return () => {
    node.style.width = prevWidth;
    node.style.maxWidth = prevMaxWidth;
  };
}

async function render(
  node: HTMLElement,
  { landscape }: { landscape: boolean },
) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(node, {
    scale: SCALE,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    // Широкие бланки (ТОРГ-12, УПД) лежат в прокручиваемой области: без явных
    // размеров в снимок попала бы только видимая часть, а не весь документ.
    width: node.scrollWidth,
    height: node.scrollHeight,
    windowWidth: Math.max(node.scrollWidth, document.documentElement.clientWidth),
    // Кнопки редактирования позиций на экране есть, в документе им не место.
    // Тот же признак, что и для печати, — отдельный список поддерживать не надо.
    ignoreElements: (el) => el.classList?.contains("print:hidden") ?? false,
  });

  const pageW = landscape ? A4.height : A4.width;
  const pageH = landscape ? A4.width : A4.height;

  const pdf = new jsPDF(landscape ? "l" : "p", "mm", "a4");

  // Высота снимка в миллиметрах, если вписать его по ширине страницы.
  const imgH = (canvas.height * pageW) / canvas.width;

  /**
   * Насколько документ может перерасти страницу, чтобы его имело смысл сжать,
   * а не разрезать. Счёт часто вылезает на пару сантиметров, и подпись уезжает
   * на второй лист одна — выглядит это хуже, чем чуть уменьшенный шрифт.
   */
  const FIT_LIMIT = 1.3;

  if (imgH <= pageH) {
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, imgH);
  } else if (imgH <= pageH * FIT_LIMIT) {
    // Вписываем целиком по высоте и ставим по центру страницы.
    const w = (canvas.width * pageH) / canvas.height;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", (pageW - w) / 2, 0, w, pageH);
  } else {
    // Документ длиннее страницы — режем снимок на полосы по высоте страницы.
    const sliceHeightPx = Math.floor((pageH * canvas.width) / pageW);
    let offset = 0;
    let first = true;

    while (offset < canvas.height) {
      const height = Math.min(sliceHeightPx, canvas.height - offset);

      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = height;

      const ctx = slice.getContext("2d");
      if (!ctx) break;
      // Белая подложка: без неё прозрачные места станут чёрными в PDF.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, offset, canvas.width, height, 0, 0, canvas.width, height);

      if (!first) pdf.addPage();
      pdf.addImage(
        slice.toDataURL("image/png"),
        "PNG",
        0,
        0,
        pageW,
        (height * pageW) / canvas.width,
      );

      first = false;
      offset += height;
    }
  }

  return pdf;
}
