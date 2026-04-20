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

interface ActItem { name: string; qty: number; unit: string; price: number; total: number; }

interface Act {
  number: string;
  date: string;
  total: number;
  items: ActItem[];
  invoice?: { number: string; client: { name: string; inn?: string | null; kpp?: string | null; legalAddress?: string | null; }; } | null;
}

interface Company {
  name: string; inn: string; kpp: string; legalAddress: string; phone?: string;
  director: string; accountant: string;
  logoKey?: string | null; stampKey?: string | null; signatureKey?: string | null;
}

export async function generateActPDF(act: Act, company: Company | null) {
  const [stampB64, signatureB64, logoB64] = await Promise.all([
    company?.stampKey ? loadImageBase64(company.stampKey) : Promise.resolve(null),
    company?.signatureKey ? loadImageBase64(company.signatureKey) : Promise.resolve(null),
    company?.logoKey ? loadImageBase64(company.logoKey) : Promise.resolve(null),
  ]);

  const client = act.invoice?.client;
  const supplierLine = [company?.name, company?.inn ? `ИНН ${company.inn}` : "", company?.kpp ? `КПП ${company.kpp}` : "", company?.legalAddress].filter(Boolean).join(", ");
  const clientLine = [client?.name, client?.inn ? `ИНН ${client.inn}` : "", client?.kpp ? `КПП ${client.kpp}` : "", client?.legalAddress].filter(Boolean).join(", ");

  const container = document.createElement("div");
  container.style.cssText = ["position:fixed","top:-9999px","left:-9999px","width:794px","background:white","font-family:Arial,Helvetica,sans-serif","color:#000","font-size:11px","line-height:1.4"].join(";");

  container.innerHTML = `<div style="padding:28px 52px 40px 52px;">
    ${logoB64 ? `<div style="text-align:right;margin-bottom:10px;"><img src="${logoB64}" style="max-height:44px;max-width:180px;object-fit:contain;" /></div>` : ""}

    <h2 style="font-size:16px;font-weight:700;margin:0 0 4px 0;">Акт выполненных работ № ${act.number}</h2>
    <p style="font-size:11px;color:#444;margin:0 0 10px 0;">от ${fmtDate(act.date)}${act.invoice ? ` к счёту № ${act.invoice.number}` : ""}</p>
    <hr style="border:none;border-top:2px solid #000;margin:0 0 10px 0;"/>

    <!-- Стороны -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10px;">
      <tr>
        <td style="width:100px;padding:3px 0;color:#555;vertical-align:top;">Исполнитель:</td>
        <td style="padding:3px 8px;font-weight:600;">${supplierLine}</td>
      </tr>
      <tr>
        <td style="width:100px;padding:3px 0;color:#555;vertical-align:top;">Заказчик:</td>
        <td style="padding:3px 8px;font-weight:600;">${clientLine || "—"}</td>
      </tr>
    </table>

    <!-- Таблица позиций -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:2px;font-size:10px;">
      <thead>
        <tr style="background:#f0f0f0;">
          <th style="border:1px solid #000;padding:5px 4px;text-align:center;width:28px;">№</th>
          <th style="border:1px solid #000;padding:5px 6px;text-align:left;">Наименование работ (услуг)</th>
          <th style="border:1px solid #000;padding:5px 4px;text-align:center;width:52px;">Кол-во</th>
          <th style="border:1px solid #000;padding:5px 4px;text-align:center;width:36px;">Ед.</th>
          <th style="border:1px solid #000;padding:5px 4px;text-align:right;width:72px;">Цена</th>
          <th style="border:1px solid #000;padding:5px 4px;text-align:right;width:80px;">Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${act.items.map((item, idx) => `
          <tr>
            <td style="border:1px solid #000;padding:4px;text-align:center;">${idx + 1}</td>
            <td style="border:1px solid #000;padding:4px 6px;">${item.name}</td>
            <td style="border:1px solid #000;padding:4px;text-align:center;">${item.qty}</td>
            <td style="border:1px solid #000;padding:4px;text-align:center;">${item.unit}</td>
            <td style="border:1px solid #000;padding:4px;text-align:right;">${fmt(item.price)}</td>
            <td style="border:1px solid #000;padding:4px;text-align:right;">${fmt(item.total)}</td>
          </tr>`).join("")}
        <tr>
          <td colspan="5" style="border:1px solid #000;padding:4px 6px;text-align:right;font-weight:700;">Итого:</td>
          <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:700;">${fmt(act.total)}</td>
        </tr>
      </tbody>
    </table>

    <p style="margin:10px 0 16px 0;font-size:10px;">
      Вышеперечисленные работы выполнены в полном объёме, в установленные сроки.
      Заказчик претензий по объёму, качеству и срокам оказания услуг не имеет.
    </p>

    <hr style="border:none;border-top:1px dashed #999;margin:0 0 16px 0;"/>

    <!-- Подписи -->
    <div style="position:relative;display:flex;align-items:flex-end;gap:40px;padding-bottom:8px;">
      <div style="flex:1;">
        <p style="font-size:10px;color:#555;margin:0 0 2px 0;font-weight:600;">ИСПОЛНИТЕЛЬ</p>
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
        <p style="font-size:10px;color:#555;margin:0 0 2px 0;font-weight:600;">ЗАКАЗЧИК</p>
        <p style="font-size:10px;margin:0 0 8px 0;">${client?.name ?? ""}</p>
        <div style="display:flex;align-items:flex-end;gap:10px;">
          <span style="font-size:11px;font-weight:600;white-space:nowrap;">Руководитель</span>
          <div style="flex:1;">
            <div style="border-bottom:1px solid #000;height:40px;"></div>
            <div style="font-size:10px;text-align:center;margin-top:2px;">_______________</div>
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
    pdf.save(`Акт-${act.number}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
