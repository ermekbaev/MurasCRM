/**
 * Скачивание документа, который формирует сервер.
 *
 * Файл нельзя открыть простой ссылкой: при незаполненных реквизитах или сбое
 * сервер отвечает объяснением, и его нужно показать, а не сохранять на диск
 * под видом PDF.
 */
export async function downloadServerPdf(url: string, fileName: string): Promise<void> {
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    alert(
      typeof body?.error === "string" ? body.error : "Не удалось сформировать PDF",
    );
    return;
  }

  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${fileName}.pdf`;
  a.click();
  URL.revokeObjectURL(href);
}
