"use client";

import { useState } from "react";

export interface LineItem {
  id?: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
}

export function useLineItems(initialItems: LineItem[]) {
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setEditItems(initialItems.map((i) => ({ id: i.id, name: i.name, qty: i.qty, unit: i.unit, price: i.price })));
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditItems([]);
  }

  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    setEditItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setEditItems((prev) => [...prev, { name: "", qty: 1, unit: "шт", price: 0 }]);
  }

  function removeItem(idx: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveItems(endpoint: string) {
    setSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: editItems.map((i) => ({ ...i, qty: Number(i.qty), price: Number(i.price) })),
        }),
      });
      if (res.ok) window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  const subtotal = editItems.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0);

  return { editing, editItems, saving, subtotal, startEditing, cancelEditing, updateItem, addItem, removeItem, saveItems };
}
