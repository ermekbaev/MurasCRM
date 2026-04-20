// Сумма прописью
const ones = ["","один","два","три","четыре","пять","шесть","семь","восемь","девять","десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать","шестнадцать","семнадцать","восемнадцать","девятнадцать"];
const onesF = ["","одна","две","три","четыре","пять","шесть","семь","восемь","девять","десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать","шестнадцать","семнадцать","восемнадцать","девятнадцать"];
const tens = ["","десять","двадцать","тридцать","сорок","пятьдесят","шестьдесят","семьдесят","восемьдесят","девяносто"];
const hundreds = ["","сто","двести","триста","четыреста","пятьсот","шестьсот","семьсот","восемьсот","девятьсот"];

function threeDigits(n: number, feminine = false): string {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
  const parts: string[] = [];
  if (h) parts.push(hundreds[h]);
  if (t === 1) { parts.push((feminine ? onesF : ones)[10 + o]); }
  else { if (t) parts.push(tens[t]); if (o) parts.push((feminine ? onesF : ones)[o]); }
  return parts.join(" ");
}

function numWord(n: number, one: string, two: string, five: string): string {
  const abs = Math.abs(n) % 100, mod10 = abs % 10;
  if (abs >= 11 && abs <= 19) return five;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return two;
  return five;
}

function numberToWords(amount: number): string {
  const rubles = Math.floor(amount);
  const kopecks = Math.round((amount - rubles) * 100);
  const billions = Math.floor(rubles / 1_000_000_000);
  const millions = Math.floor((rubles % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((rubles % 1_000_000) / 1_000);
  const remainder = rubles % 1_000;
  const parts: string[] = [];
  if (billions) { parts.push(threeDigits(billions)); parts.push(numWord(billions, "миллиард", "миллиарда", "миллиардов")); }
  if (millions) { parts.push(threeDigits(millions)); parts.push(numWord(millions, "миллион", "миллиона", "миллионов")); }
  if (thousands) { parts.push(threeDigits(thousands, true)); parts.push(numWord(thousands, "тысяча", "тысячи", "тысяч")); }
  if (remainder || rubles === 0) parts.push(threeDigits(remainder));
  const rublesStr = parts.filter(Boolean).join(" ") || "ноль";
  const rublesWord = numWord(rubles % 1000 === 0 ? rubles / 1000 : remainder, "рубль", "рубля", "рублей");
  const kopStr = kopecks.toString().padStart(2, "0");
  const kopWord = numWord(kopecks, "копейка", "копейки", "копеек");
  return (rublesStr.charAt(0).toUpperCase() + rublesStr.slice(1)) + ` ${rublesWord} ${kopStr} ${kopWord}`;
}

function fmt(n: number) {
  return n.toLocaleString("ru", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
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
  } catch { return null; }
}

interface InvoiceItem { name: string; qty: number; unit: string; price: number; total: number; }

interface Invoice {
  number: string;
  date: string;
  dueDate?: string | null;
  basis?: string | null;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  items: InvoiceItem[];
  client: { name: string; inn?: string | null; kpp?: string | null; legalAddress?: string | null; bankName?: string | null; bankAccount?: string | null; bankBik?: string | null; };
}

interface Company {
  name: string; inn: string; kpp: string; ogrn?: string; legalAddress: string;
  bankName: string; bankAccount: string; bankBik: string; corrAccount: string;
  director: string; accountant: string;
  logoKey?: string | null; stampKey?: string | null; signatureKey?: string | null;
}

export async function generateInvoicePDF(invoice: Invoice, company: Company | null) {
  const subtotal = invoice.subtotal;
  const vatAmount = invoice.vatAmount;
  const total = invoice.total;

  const [stampB64, signatureB64, logoB64] = await Promise.all([
    company?.stampKey ? loadImageBase64(company.stampKey) : Promise.resolve(null),
    company?.signatureKey ? loadImageBase64(company.signatureKey) : Promise.resolve(null),
    company?.logoKey ? loadImageBase64(company.logoKey) : Promise.resolve(null),
  ]);

  const supplierFullLine = [company?.name, company?.inn ? `ИНН ${company.inn}` : "", company?.kpp ? `КПП ${company.kpp}` : "", company?.legalAddress].filter(Boolean).join(", ");
  const clientFullLine = [invoice.client?.name, invoice.client?.inn ? `ИНН ${invoice.client.inn}` : "", invoice.client?.kpp ? `КПП ${invoice.client.kpp}` : "", invoice.client?.legalAddress].filter(Boolean).join(", ");

  const container = document.createElement("div");
  container.style.cssText = ["position:fixed","top:-9999px","left:-9999px","width:794px","background:white","font-family:Arial,Helvetica,sans-serif","color:#000","font-size:11px","line-height:1.4"].join(";");

  container.innerHTML = `<div style="padding:28px 52px 40px 52px;">
    ${logoB64 ? `<div style="text-align:right;margin-bottom:10px;"><img src="${logoB64}" style="max-height:44px;max-width:180px;object-fit:contain;" /></div>` : ""}

    <!-- Банковский блок -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10px;">
      <tr>
        <td style="border:1px solid #000;padding:4px 6px;width:55%;">
          <div style="font-size:9px;color:#555;margin-bottom:2px;">Банк получателя</div>
          <strong>${company?.bankName ?? ""}</strong>
        </td>
        <td style="border:1px solid #000;padding:4px 6px;width:15%;">
          <div style="font-size:9px;color:#555;">БИК</div>
          <strong>${company?.bankBik ?? ""}</strong>
        </td>
        <td style="border:1px solid #000;padding:4px 6px;width:30%;">
          <div style="font-size:9px;color:#555;">Сч. №</div>
          <strong>${company?.corrAccount ?? ""}</strong>
        </td>
      </tr>
      <tr>
        <td style="border:1px solid #000;padding:4px 6px;">
          <span style="font-size:9px;color:#555;">ИНН </span><strong>${company?.inn ?? ""}</strong>
          <span style="font-size:9px;color:#555;margin-left:12px;">КПП </span><strong>${company?.kpp ?? ""}</strong>
          <br/><strong>${company?.name ?? ""}</strong>
          <div style="font-size:9px;color:#555;">Получатель</div>
        </td>
        <td style="border:1px solid #000;padding:4px 6px;vertical-align:top;">
          <div style="font-size:9px;color:#555;">Сч. №</div>
          <strong>${company?.bankAccount ?? ""}</strong>
        </td>
        <td style="border:1px solid #000;padding:4px 6px;"></td>
      </tr>
    </table>

    <!-- Заголовок -->
    <h2 style="font-size:16px;font-weight:700;margin:0 0 10px 0;">Счёт на оплату № ${invoice.number} от ${fmtDate(invoice.date)}</h2>
    <hr style="border:none;border-top:2px solid #000;margin:0 0 10px 0;"/>

    <!-- Стороны -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:10px;">
      <tr>
        <td style="width:130px;padding:2px 0;color:#555;vertical-align:top;">Поставщик (Исполнитель):</td>
        <td style="padding:2px 8px;font-weight:600;">${supplierFullLine}</td>
      </tr>
      <tr>
        <td style="width:130px;padding:2px 0;color:#555;vertical-align:top;">Покупатель (Заказчик):</td>
        <td style="padding:2px 8px;font-weight:600;">${clientFullLine}</td>
      </tr>
      <tr>
        <td style="width:130px;padding:2px 0;color:#555;">Основание:</td>
        <td style="padding:2px 8px;font-weight:700;">${invoice.basis ?? "Основной договор"}</td>
      </tr>
    </table>

    <!-- Таблица позиций -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:2px;font-size:10px;">
      <thead>
        <tr style="background:#f0f0f0;">
          <th style="border:1px solid #000;padding:5px 4px;text-align:center;width:28px;">№</th>
          <th style="border:1px solid #000;padding:5px 6px;text-align:left;">Товары (работы, услуги)</th>
          <th style="border:1px solid #000;padding:5px 4px;text-align:center;width:52px;">Кол-во</th>
          <th style="border:1px solid #000;padding:5px 4px;text-align:center;width:36px;">Ед.</th>
          <th style="border:1px solid #000;padding:5px 4px;text-align:right;width:72px;">Цена</th>
          <th style="border:1px solid #000;padding:5px 4px;text-align:right;width:80px;">Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items.map((item, idx) => `
          <tr>
            <td style="border:1px solid #000;padding:4px;text-align:center;">${idx + 1}</td>
            <td style="border:1px solid #000;padding:4px 6px;">${item.name}</td>
            <td style="border:1px solid #000;padding:4px;text-align:center;">${item.qty}</td>
            <td style="border:1px solid #000;padding:4px;text-align:center;">${item.unit}</td>
            <td style="border:1px solid #000;padding:4px;text-align:right;">${fmt(item.price)}</td>
            <td style="border:1px solid #000;padding:4px;text-align:right;">${fmt(item.total)}</td>
          </tr>`).join("")}
        <tr>
          <td colspan="5" style="border:1px solid #000;padding:4px 6px;text-align:right;font-weight:700;">${invoice.vatRate > 0 ? "Без НДС:" : "Итого:"}</td>
          <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:700;">${fmt(subtotal)}</td>
        </tr>
        <tr>
          <td colspan="5" style="border:1px solid #000;padding:4px 6px;text-align:right;font-size:10px;">НДС${invoice.vatRate > 0 ? ` ${invoice.vatRate}%` : ""}:</td>
          <td style="border:1px solid #000;padding:4px 6px;text-align:right;font-size:10px;">${invoice.vatRate > 0 ? fmt(vatAmount) : "Без НДС"}</td>
        </tr>
        <tr>
          <td colspan="5" style="border:1px solid #000;padding:4px 6px;text-align:right;font-weight:700;">Всего к оплате:</td>
          <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:700;">${fmt(total)}</td>
        </tr>
      </tbody>
    </table>

    <p style="margin:8px 0 4px 0;font-size:10px;">Всего наименований ${invoice.items.length}, на сумму <strong>${fmt(total)} руб.</strong></p>
    <p style="margin:0 0 8px 0;font-size:10px;font-weight:700;">${numberToWords(total)}</p>
    ${invoice.dueDate ? `<p style="margin:0 0 6px 0;font-size:10px;">Оплатить не позднее ${fmtDate(invoice.dueDate)}</p>` : ""}

    <p style="margin:0 0 2px 0;font-size:9.5px;">Оплата данного счета означает согласие с условиями оказания услуг.</p>
    <p style="margin:0 0 20px 0;font-size:9.5px;">Уведомление об оплате обязательно.</p>

    <hr style="border:none;border-top:1px dashed #999;margin:0 0 16px 0;"/>

    <!-- Подписи -->
    <div style="position:relative;display:flex;align-items:flex-end;gap:40px;margin-top:4px;padding-bottom:8px;">
      <div style="flex:1;">
        <div style="display:flex;align-items:flex-end;gap:10px;">
          <span style="font-size:11px;font-weight:600;white-space:nowrap;">Руководитель</span>
          <div style="flex:1;">
            <div style="border-bottom:1px solid #000;height:40px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:2px;">
              ${signatureB64 ? `<img src="${signatureB64}" style="height:50px;opacity:0.85;object-fit:contain;" />` : ""}
            </div>
            <div style="font-size:10px;text-align:center;margin-top:2px;">${company?.director ?? ""}</div>
          </div>
        </div>
      </div>
      <div style="flex:1;">
        <div style="display:flex;align-items:flex-end;gap:10px;">
          <span style="font-size:11px;font-weight:600;white-space:nowrap;">Бухгалтер</span>
          <div style="flex:1;">
            <div style="border-bottom:1px solid #000;height:56px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:2px;">
              ${signatureB64 ? `<img src="${signatureB64}" style="height:50px;opacity:0.85;object-fit:contain;" />` : ""}
            </div>
            <div style="font-size:10px;text-align:center;margin-top:2px;">${company?.accountant ?? ""}</div>
          </div>
        </div>
      </div>
      ${stampB64 ? `<div style="position:absolute;left:120px;bottom:8px;transform:translateX(-50%);">
        <img src="${stampB64}" style="height:90px;width:90px;object-fit:contain;opacity:0.8;" />
      </div>` : ""}
    </div>
  </div>`;

  document.body.appendChild(container);
  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    if (imgH <= pageH) {
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, imgH);
    } else {
      const pxPerPage = (canvas.width * pageH) / pageW;
      let offsetPx = 0;
      while (offsetPx < canvas.height) {
        const sliceH = Math.min(pxPerPage, canvas.height - offsetPx);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        sliceCanvas.getContext("2d")!.drawImage(canvas, 0, -offsetPx);
        if (offsetPx > 0) pdf.addPage();
        pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", 0, 0, pageW, (sliceH * pageW) / canvas.width);
        offsetPx += pxPerPage;
      }
    }
    pdf.save(`Счёт-${invoice.number}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
