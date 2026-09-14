import type { Browser } from "playwright-core";

/**
 * PDF документов делает сервер, а не браузер сотрудника.
 *
 * Раньше страница фотографировалась через html2canvas прямо у пользователя.
 * Это оказалось ненадёжно: библиотека читает стили страницы, и если хоть один
 * подключённый стиль ей недоступен — например, его вставило расширение
 * браузера, — она молча рисует всё стилями по умолчанию. У заказчика документ
 * выходил без рамок и с наехавшими подписями, а у нас на сервере тот же код
 * давал верный файл. Воспроизвести чужой набор расширений нельзя, значит от
 * браузера сотрудника нужно просто не зависеть.
 *
 * Здесь страницу открывает headless-Chromium на сервере и печатает её своим
 * штатным механизмом. Результат одинаков у всех и получается настоящим PDF с
 * текстом и векторными линиями, а не картинкой.
 */

/** Где лежит браузер. Путь задаётся настройкой: он разный на разных машинах. */
const CHROMIUM_PATH = process.env.PDF_CHROMIUM_PATH;

/** Дольше этого документ не формируется — значит что-то пошло не так. */
const TIMEOUT_MS = 45_000;

export class PdfRendererUnavailableError extends Error {}

/**
 * Один браузер на всё приложение.
 *
 * Запуск Chromium стоит около секунды и сотни мегабайт, поэтому держим
 * экземпляр между запросами, а закрываем только страницы. Через globalThis —
 * иначе горячая перезагрузка в разработке плодит браузеры.
 */
const globalForPdf = globalThis as unknown as { pdfBrowser?: Browser | null };

async function getBrowser(): Promise<Browser> {
  if (globalForPdf.pdfBrowser?.isConnected()) return globalForPdf.pdfBrowser;

  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    throw new PdfRendererUnavailableError(
      "Не установлен playwright-core — формирование PDF на сервере недоступно",
    );
  }

  try {
    globalForPdf.pdfBrowser = await chromium.launch({
      ...(CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {}),
      // Без песочницы: приложение и так работает в своём окружении, а
      // включённая песочница требует прав, которых у процесса нет.
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  } catch (e) {
    throw new PdfRendererUnavailableError(
      e instanceof Error ? e.message : "Не удалось запустить браузер",
    );
  }

  return globalForPdf.pdfBrowser;
}

export interface RenderOptions {
  /** Полный адрес страницы документа на этом же сайте. */
  url: string;
  /** Заголовок Cookie из входящего запроса — страница откроется от лица пользователя. */
  cookie: string;
  landscape?: boolean;
}

export async function renderPdf({
  url,
  cookie,
  landscape = false,
}: RenderOptions): Promise<Buffer> {
  const browser = await getBrowser();
  const target = new URL(url);

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    // Печать всегда в светлой теме: документ белый независимо от того, какую
    // тему выбрал сотрудник.
    colorScheme: "light",
  });

  try {
    // Куки отдаём как есть: разбирать сессию самим незачем, страница сама
    // проверит права обычным способом.
    //
    // Привязываем их к адресу, а не к домену с путём: сессионная кука NextAuth
    // называется с приставкой __Secure-, и браузер принимает такую только с
    // признаком защищённого соединения и без отдельного домена.
    const cookies = cookie
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.includes("="))
      .map((part) => {
        const eq = part.indexOf("=");
        return {
          name: part.slice(0, eq).trim(),
          value: part.slice(eq + 1),
          url: target.origin,
          secure: target.protocol === "https:",
          sameSite: "Lax" as const,
        };
      })
      .filter((c) => c.name.length > 0);

    if (cookies.length > 0) await context.addCookies(cookies);

    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: TIMEOUT_MS });

    // Логотип и печать приходят отдельными запросами — ждём, пока отрисуются,
    // иначе документ уйдёт без них.
    await page
      .waitForFunction(
        () => Array.from(document.images).every((img) => img.complete),
        undefined,
        { timeout: 10_000 },
      )
      .catch(() => {
        // Картинка может и не загрузиться — документ важнее.
      });

    const pdf = await page.pdf({
      format: "A4",
      landscape,
      // Фон и рамки должны попасть в файл, иначе бланк выйдет пустым.
      printBackground: true,
      margin: { top: "6mm", right: "6mm", bottom: "6mm", left: "6mm" },
    });

    return Buffer.from(pdf);
  } finally {
    await context.close().catch(() => {});
  }
}

/** Адрес сайта, каким его видит браузер снаружи. */
export function siteOrigin(req: Request): string {
  const configured = process.env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/$/, "");

  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
