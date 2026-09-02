// Только для серверных модулей: запускает внешний процесс.
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const run = promisify(execFile);

/** Конвертация не должна висеть вечно: обычный бланк укладывается в секунду. */
const TIMEOUT_MS = 60_000;

export class PdfUnavailableError extends Error {}

/**
 * Превращает DOCX в PDF через LibreOffice в headless-режиме.
 *
 * Каждой конвертации даём свой каталог профиля: без него параллельные запуски
 * дерутся за общий профиль и молча падают. Каталог и все временные файлы
 * убираются в finally.
 */
export async function docxToPdf(docx: Buffer, baseName = "document"): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "docx2pdf-"));
  const src = join(dir, "in.docx");
  const profile = join(dir, "profile");

  try {
    await writeFile(src, docx);

    await run(
      "soffice",
      [
        "--headless",
        "--norestore",
        `-env:UserInstallation=file://${profile}`,
        "--convert-to",
        "pdf",
        "--outdir",
        dir,
        src,
      ],
      { timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
    ).catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") {
        throw new PdfUnavailableError(
          "На сервере не установлен LibreOffice — PDF собрать нечем",
        );
      }
      throw e;
    });

    return await readFile(join(dir, "in.pdf")).catch(() => {
      throw new Error("LibreOffice не создал PDF — возможно, бланк повреждён");
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    void baseName;
  }
}
