"use client";

import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface DocumentItem {
  name: string;
  qty: number;
  unit: string;
  price: number;
}

export const EMPTY_DOCUMENT_ITEM: DocumentItem = { name: "", qty: 1, unit: "шт", price: 0 };

const ITEM_CLASS =
  "w-full rounded border border-line bg-surface px-2 py-1 text-sm text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

/** Редактируемая таблица позиций — общая для счетов, актов и накладных. */
export default function DocumentItemsTable({
  items,
  onChange,
  onAdd,
  onRemove,
  label = "Позиции",
}: {
  items: DocumentItem[];
  onChange: (idx: number, field: keyof DocumentItem, value: string | number) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  label?: string;
}) {
  const total = items.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-fg-muted">{label}</label>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-medium text-accent hover:text-accent-hover"
        >
          + Добавить строку
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-surface-sunken">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-fg-muted">Наименование</th>
              <th className="w-16 px-3 py-2 text-right text-xs font-medium text-fg-muted">Кол-во</th>
              <th className="w-16 px-3 py-2 text-left text-xs font-medium text-fg-muted">Ед.</th>
              <th className="w-24 px-3 py-2 text-right text-xs font-medium text-fg-muted">Цена</th>
              <th className="w-24 px-3 py-2 text-right text-xs font-medium text-fg-muted">Сумма</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {items.map((item, idx) => (
              <tr key={idx}>
                <td className="px-2 py-1.5">
                  <input
                    value={item.name}
                    onChange={(e) => onChange(idx, "name", e.target.value)}
                    required
                    className={ITEM_CLASS}
                    placeholder="Наименование"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    value={item.qty}
                    onChange={(e) => onChange(idx, "qty", e.target.value)}
                    min={0.01}
                    step="any"
                    required
                    className={ITEM_CLASS + " text-right"}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    value={item.unit}
                    onChange={(e) => onChange(idx, "unit", e.target.value)}
                    className={ITEM_CLASS}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => onChange(idx, "price", e.target.value)}
                    min={0}
                    step="any"
                    required
                    className={ITEM_CLASS + " text-right"}
                  />
                </td>
                <td className="px-3 py-1.5 text-right text-sm font-medium text-fg">
                  {formatCurrency(Number(item.qty) * Number(item.price))}
                </td>
                <td className="px-1 py-1.5">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemove(idx)}
                      className="p-1 text-fg-subtle transition-colors hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex justify-end">
        <span className="text-sm font-bold text-fg">Итого: {formatCurrency(total)}</span>
      </div>
    </div>
  );
}
