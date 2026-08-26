import { legalName } from "@/lib/utils";
import { numberToWords } from "@/lib/invoice-pdf";

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
  } catch {
    return null;
  }
}

interface WaybillItem {
  name: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
}

interface Party {
  name: string;
  fullName?: string | null;
  inn?: string | null;
  kpp?: string | null;
  legalAddress?: string | null;
}

interface Waybill {
  number: string;
  date: string;
  basis: string | null;
  total: number;
  items: WaybillItem[];
  client: Party;
  payer?: Party | null;
  consignee?: Party | null;
}

interface Company {
  name: string;
  inn: string;
  kpp: string;
  legalAddress: string;
  phone?: string;
  director: string;
  accountant: string;
  logoKey?: string | null;
  stampKey?: string | null;
  signatureKey?: string | null;
}

function partyLine(p: Party | null | undefined): string {
  if (!p) return "—";
  return [
    legalName(p),
    p.inn ? `ИНН ${p.inn}` : "",
    p.kpp ? `КПП ${p.kpp}` : "",
    p.legalAddress,
  ]
    .filter(Boolean)
    .join(", ");
}

export async function generateWaybillPDF(waybill: Waybill, company: Company | null) {
  const [stampB64, signatureB64, logoB64] = await Promise.all([
    company?.stampKey ? loadImageBase64(company.stampKey) : Promise.resolve(null),
    company?.signatureKey ? loadImageBase64(company.signatureKey) : Promise.resolve(null),
    company?.logoKey ? loadImageBase64(company.logoKey) : Promise.resolve(null),
  ]);

  // Плательщик и грузополучатель по умолчанию — контрагент накладной.
  const payer = waybill.payer ?? waybill.client;
  const consignee = waybill.consignee ?? waybill.client;

  const supplierLine = [
    company?.name,
    company?.inn ? `ИНН ${company.inn}` : "",
    company?.kpp ? `КПП ${company.kpp}` : "",
    company?.legalAddress,
  ]
    .filter(Boolean)
    .join(", ");

  const totalQty = waybill.items.reduce((s, i) => s + Number(i.qty), 0);

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
  <div style="padding:32px 36px;color:#111;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;">
      <div style="display:flex;align-items:flex-start;gap:12px;">
        ${logoB64 ? `<img src="${logoB64}" style="height:44px;object-fit:contain;" />` : ""}
        <div>
          <h1 style="font-size:20px;margin:0;font-weight:700;">ТОВАРНАЯ НАКЛАДНАЯ</h1>
          <p style="font-size:13px;margin:4px 0 0 0;font-weight:600;">№ ${waybill.number}</p>
          <p style="font-size:11px;margin:2px 0 0 0;color:#555;">от ${fmtDate(waybill.date)}</p>
        </div>
      </div>
      ${
        waybill.basis
          ? `<div style="max-width:240px;text-align:right;font-size:10px;color:#555;">Основание: <span style="color:#111;font-weight:600;">${waybill.basis}</span></div>`
          : ""
      }
    </div>

    <table style="width:100%;font-size:10px;margin-bottom:16px;border-collapse:collapse;">
      <tr>
        <td style="width:110px;padding:3px 0;color:#555;vertical-align:top;">Поставщик:</td>
        <td style="padding:3px 8px;font-weight:600;">${supplierLine || "—"}</td>
      </tr>
      <tr>
        <td style="padding:3px 0;color:#555;vertical-align:top;">Плательщик:</td>
        <td style="padding:3px 8px;font-weight:600;">${partyLine(payer)}</td>
      </tr>
      <tr>
        <td style="padding:3px 0;color:#555;vertical-align:top;">Грузополучатель:</td>
        <td style="padding:3px 8px;font-weight:600;">${partyLine(consignee)}</td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;font-size:10px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="border:1px solid #999;padding:5px;text-align:left;width:28px;">№</th>
          <th style="border:1px solid #999;padding:5px;text-align:left;">Наименование</th>
          <th style="border:1px solid #999;padding:5px;text-align:right;width:60px;">Кол-во</th>
          <th style="border:1px solid #999;padding:5px;text-align:left;width:46px;">Ед.</th>
          <th style="border:1px solid #999;padding:5px;text-align:right;width:80px;">Цена</th>
          <th style="border:1px solid #999;padding:5px;text-align:right;width:90px;">Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${waybill.items
          .map(
            (i, idx) => `
        <tr>
          <td style="border:1px solid #999;padding:5px;">${idx + 1}</td>
          <td style="border:1px solid #999;padding:5px;">${i.name}</td>
          <td style="border:1px solid #999;padding:5px;text-align:right;">${Number(i.qty)}</td>
          <td style="border:1px solid #999;padding:5px;">${i.unit}</td>
          <td style="border:1px solid #999;padding:5px;text-align:right;">${fmt(Number(i.price))}</td>
          <td style="border:1px solid #999;padding:5px;text-align:right;font-weight:600;">${fmt(Number(i.total))}</td>
        </tr>`,
          )
          .join("")}
        <tr>
          <td colspan="5" style="border:1px solid #999;padding:5px;text-align:right;font-weight:700;">Итого:</td>
          <td style="border:1px solid #999;padding:5px;text-align:right;font-weight:700;">${fmt(waybill.total)}</td>
        </tr>
      </tbody>
    </table>

    <p style="font-size:10px;margin:10px 0 4px 0;">
      Всего наименований ${waybill.items.length}, общее количество ${totalQty}, на сумму ${fmt(waybill.total)} руб.
    </p>
    <p style="font-size:10px;margin:0 0 16px 0;font-weight:600;">${numberToWords(waybill.total)}</p>

    <hr style="border:none;border-top:1px dashed #999;margin:0 0 16px 0;"/>

    <div style="position:relative;display:flex;align-items:flex-end;gap:40px;padding-bottom:8px;">
      <div style="flex:1;">
        <p style="font-size:10px;color:#555;margin:0 0 2px 0;font-weight:600;">ОТПУСТИЛ</p>
        <p style="font-size:10px;margin:0 0 8px 0;">${company?.name ?? ""}</p>
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
        <p style="font-size:10px;color:#555;margin:0 0 2px 0;font-weight:600;">ГРУЗ ПРИНЯЛ</p>
        <p style="font-size:10px;margin:0 0 8px 0;">${legalName(consignee)}</p>
        <div style="display:flex;align-items:flex-end;gap:10px;">
          <span style="font-size:11px;font-weight:600;white-space:nowrap;">Подпись</span>
          <div style="flex:1;">
            <div style="border-bottom:1px solid #000;height:40px;"></div>
            <div style="font-size:10px;text-align:center;margin-top:2px;">_______________</div>
          </div>
        </div>
      </div>
      ${
        stampB64
          ? `<div style="position:absolute;left:120px;bottom:8px;transform:translateX(-50%);">
        <img src="${stampB64}" style="height:90px;width:90px;object-fit:contain;opacity:0.8;" />
      </div>`
          : ""
      }
    </div>
  </div>`;

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
    pdf.save(`Накладная-${waybill.number}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
