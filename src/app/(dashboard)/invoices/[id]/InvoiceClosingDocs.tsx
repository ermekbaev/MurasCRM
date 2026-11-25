"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import { FileCode, Plus } from "lucide-react";

interface Doc {
  id: string;
  number: string;
  date: string;
}

interface Props {
  invoiceId: string;
  orderId: string | null;
  items: { name: string; qty: number; unit: string; price: number }[];
  waybills: Doc[];
  acts: Doc[];
}

/**
 * Закрывающие документы по счёту (Сергей из DASS 26.11: в Битриксе УПД, накладные и акты делаются «на основе счёта»,
 * и XML для ЭДО логичнее брать оттуда же). Счёт — центр: отсюда создаём УПД и акт и видим, что по нему уже сделано.
 * Разделы «Накладные» и «Акты» остаются журналом для бухгалтера.
 */
export default function InvoiceClosingDocs({ invoiceId, orderId, items, waybills, acts }: Props) {
  const [creating, setCreating] = useState<"waybill" | "act" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(kind: "waybill" | "act") {
    setCreating(kind);
    setError(null);
    try {
      // накладная берёт позиции и основание «Счёт № …» из самого счёта; акту позиции передаём явно
      const body =
        kind === "waybill"
          ? { invoiceId, ...(orderId ? { orderId } : {}) }
          : { invoiceId, ...(orderId ? { orderId } : {}), items };
      const res = await fetch(kind === "waybill" ? "/api/waybills" : "/api/acts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        setError(typeof b?.error === "string" ? b.error : kind === "waybill" ? "Не удалось создать УПД" : "Не удалось создать акт");
        return;
      }
      const doc = await res.json();
      window.location.href = kind === "waybill" ? `/waybills/${doc.id}` : `/acts/${doc.id}`;
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setCreating(null);
    }
  }

  // как на странице накладной: при незаполненных реквизитах сервер присылает объяснение вместо файла — показываем его
  async function downloadXml(w: Doc) {
    setError(null);
    const res = await fetch(`/api/waybills/${w.id}/upd-xml`).catch(() => null);
    if (!res?.ok) {
      const b = await res?.json().catch(() => null);
      setError(typeof b?.error === "string" ? b.error : "Не удалось сформировать XML");
      return;
    }
    const blob = await res.blob();
    const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `upd-${w.number}.xml`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const empty = waybills.length === 0 && acts.length === 0;

  return (
    <Card padding="md" className="max-w-3xl mx-auto mb-6 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">Документы по счёту</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {empty ? "УПД и акт возьмут клиента и позиции из этого счёта" : "Сделано по этому счёту"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => create("waybill")} loading={creating === "waybill"} disabled={items.length === 0}>
            <Plus size={16} /> УПД / накладная
          </Button>
          <Button variant="outline" onClick={() => create("act")} loading={creating === "act"} disabled={items.length === 0}>
            <Plus size={16} /> Акт
          </Button>
        </div>
      </div>

      {!empty && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {waybills.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <Link href={`/waybills/${w.id}`} className="text-accent hover:underline">
                УПД / накладная № {w.number} от {formatDate(w.date)}
              </Link>
              {/* XML формата ФНС 5.03 для загрузки в ЭДО — прямо отсюда, без захода в накладную */}
              <button type="button" onClick={() => downloadXml(w)} className="flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg">
                <FileCode size={14} /> XML для ЭДО
              </button>
            </li>
          ))}
          {acts.map((a) => (
            <li key={a.id} className="py-2 text-sm">
              <Link href={`/acts/${a.id}`} className="text-accent hover:underline">
                Акт № {a.number} от {formatDate(a.date)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </Card>
  );
}
