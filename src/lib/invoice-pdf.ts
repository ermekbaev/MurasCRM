// Сумма прописью (сом/тыйын)
const ones  = ["","один","два","три","четыре","пять","шесть","семь","восемь","девять","десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать","шестнадцать","семнадцать","восемнадцать","девятнадцать"];
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

export function numberToWords(amount: number): string {
  const soms = Math.floor(amount);
  const tiyin = Math.round((amount - soms) * 100);
  const billions = Math.floor(soms / 1_000_000_000);
  const millions = Math.floor((soms % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((soms % 1_000_000) / 1_000);
  const remainder = soms % 1_000;
  const parts: string[] = [];
  if (billions)  { parts.push(threeDigits(billions));       parts.push(numWord(billions,  "миллиард",  "миллиарда",  "миллиардов")); }
  if (millions)  { parts.push(threeDigits(millions));       parts.push(numWord(millions,  "миллион",   "миллиона",   "миллионов")); }
  if (thousands) { parts.push(threeDigits(thousands, true)); parts.push(numWord(thousands, "тысяча",    "тысячи",     "тысяч")); }
  if (remainder || soms === 0) parts.push(threeDigits(remainder));
  const somsStr = parts.filter(Boolean).join(" ") || "ноль";
  const somsWord = numWord(remainder === 0 ? soms : remainder, "сом", "сома", "сом");
  const tiyinStr = tiyin.toString().padStart(2, "0");
  const tiyinWord = numWord(tiyin, "тыйын", "тыйына", "тыйын");
  return (somsStr.charAt(0).toUpperCase() + somsStr.slice(1)) + ` ${somsWord} ${tiyinStr} ${tiyinWord}`;
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
  isPaid?: boolean;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  items: InvoiceItem[];
  client: { name: string; inn?: string | null; kpp?: string | null; legalAddress?: string | null; bankName?: string | null; bankAccount?: string | null; bankBik?: string | null; };
}

interface Company {
  name: string; inn: string; kpp: string; ogrn?: string; legalAddress: string; phone: string;
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

  // Supplier full line: name, INN, address, phone, account in bank, BIK
  const supplierParts = [
    company?.name,
    company?.inn ? `ИНН ${company.inn}` : "",
    company?.legalAddress,
    company?.phone ? `тел.: ${company.phone}` : "",
    company?.bankAccount && company?.bankName ? `р/с ${company.bankAccount} в банке ${company.bankName}` : "",
    company?.bankBik ? `БИК ${company.bankBik}` : "",
  ].filter(Boolean).join(", ");

  const clientFullLine = [
    invoice.client?.name,
    invoice.client?.inn ? `ИНН ${invoice.client.inn}` : "",
    invoice.client?.legalAddress,
  ].filter(Boolean).join(", ");

  const container = document.createElement("div");
  container.style.cssText = [
    "position:fixed","top:-9999px","left:-9999px","width:794px",
    "background:white","font-family:Arial,Helvetica,sans-serif",
    "color:#000","font-size:11px","line-height:1.4",
  ].join(";");

  container.innerHTML = `<div style="padding:28px 40px 40px 40px;">
    ${logoB64 ? `<div style="text-align:right;margin-bottom:8px;"><img src="${logoB64}" style="max-height:44px;max-width:180px;object-fit:contain;" /></div>` : ""}

    <!-- Банковский блок -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:10px;">
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
    <h2 style="font-size:15px;font-weight:700;margin:0 0 6px 0;">Счёт на оплату № ${invoice.number} от ${fmtDate(invoice.date)}</h2>
    <hr style="border:none;border-top:3px solid #000;margin:0 0 2px 0;"/>
    <hr style="border:none;border-top:1px solid #000;margin:0 0 10px 0;"/>

    <!-- Стороны -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:10px;">
      <tr>
        <td style="width:110px;padding:3px 0;color:#555;vertical-align:top;white-space:nowrap;">Поставщик:</td>
        <td style="padding:3px 8px;font-weight:600;">${supplierParts}</td>
      </tr>
      <tr>
        <td style="width:110px;padding:3px 0;color:#555;vertical-align:top;white-space:nowrap;">Склад:</td>
        <td style="padding:3px 8px;"></td>
      </tr>
      <tr>
        <td style="width:110px;padding:3px 0;color:#555;vertical-align:top;white-space:nowrap;">Заказчик:</td>
        <td style="padding:3px 8px;font-weight:600;">${clientFullLine}</td>
      </tr>
      ${invoice.basis ? `<tr>
        <td style="width:110px;padding:3px 0;color:#555;vertical-align:top;white-space:nowrap;">Комментарий:</td>
        <td style="padding:3px 8px;">${invoice.basis}</td>
      </tr>` : ""}
    </table>

    <!-- Таблица позиций -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:2px;font-size:10px;">
      <thead>
        <tr style="background:#f0f0f0;">
          <th style="border:1px solid #000;padding:5px 4px;text-align:center;width:28px;">№ п/п</th>
          <th style="border:1px solid #000;padding:5px 4px;text-align:center;width:36px;">Код</th>
          <th style="border:1px solid #000;padding:5px 6px;text-align:left;">Наименование</th>
          <th style="border:1px solid #000;padding:5px 4px;text-align:center;width:70px;">Количество</th>
          <th style="border:1px solid #000;padding:5px 4px;text-align:right;width:72px;">Цена</th>
          <th style="border:1px solid #000;padding:5px 4px;text-align:right;width:80px;">Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items.map((item, idx) => `
          <tr>
            <td style="border:1px solid #000;padding:4px;text-align:center;">${idx + 1}</td>
            <td style="border:1px solid #000;padding:4px;text-align:center;"></td>
            <td style="border:1px solid #000;padding:4px 6px;">${item.name}</td>
            <td style="border:1px solid #000;padding:4px;text-align:center;">${item.qty} ${item.unit}</td>
            <td style="border:1px solid #000;padding:4px;text-align:right;">${fmt(item.price)}</td>
            <td style="border:1px solid #000;padding:4px;text-align:right;">${fmt(item.total)}</td>
          </tr>`).join("")}
        <tr>
          <td colspan="5" style="border:1px solid #000;padding:4px 6px;text-align:right;font-weight:700;">Итого:</td>
          <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:700;">${fmt(subtotal)}</td>
        </tr>
        ${invoice.vatRate > 0 ? `
        <tr>
          <td colspan="5" style="border:1px solid #000;padding:4px 6px;text-align:right;">НДС ${invoice.vatRate}%:</td>
          <td style="border:1px solid #000;padding:4px;text-align:right;">${fmt(vatAmount)}</td>
        </tr>
        <tr>
          <td colspan="5" style="border:1px solid #000;padding:4px 6px;text-align:right;font-weight:700;">Всего к оплате:</td>
          <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:700;">${fmt(total)}</td>
        </tr>` : ""}
      </tbody>
    </table>

    <p style="margin:8px 0 2px 0;font-size:10px;">Всего наименований ${invoice.items.length}, на сумму <strong>${fmt(total)} сом</strong></p>
    <p style="margin:0 0 ${invoice.dueDate ? "4" : "8"}px 0;font-size:10px;font-weight:700;">${numberToWords(total)}</p>
    ${invoice.dueDate ? `<p style="margin:0 0 8px 0;font-size:10px;">Оплатить не позднее ${fmtDate(invoice.dueDate)}</p>` : ""}

    <div style="margin:8px 0 14px 0;display:flex;align-items:center;gap:8px;">
      <span style="font-size:10px;color:#555;">Статус оплаты:</span>
      <span style="font-size:11px;font-weight:700;color:${invoice.isPaid ? "#15803d" : "#b91c1c"};border:2px solid ${invoice.isPaid ? "#15803d" : "#b91c1c"};padding:2px 10px;border-radius:4px;letter-spacing:0.5px;">
        ${invoice.isPaid ? "ОПЛАЧЕН" : "НЕ ОПЛАЧЕН"}
      </span>
    </div>

    <hr style="border:none;border-top:1px dashed #999;margin:0 0 14px 0;"/>

    <!-- Подписи -->
    <div style="position:relative;display:flex;align-items:flex-end;gap:40px;padding-bottom:8px;">
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
          <span style="font-size:11px;font-weight:600;white-space:nowrap;">Бухгалтер/менеджер</span>
          <div style="flex:1;">
            <div style="border-bottom:1px solid #000;height:40px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:2px;">
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
