"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Pencil } from "lucide-react";

interface Client {
  id: string;
  type: string;
  name: string;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  whatsapp: string | null;
  legalAddress: string | null;
  postalAddress: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankBik: string | null;
  corrAccount: string | null;
  source: string;
  notes: string | null;
}

export default function ClientEditButton({ client }: { client: Client }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: client.type,
    name: client.name,
    phone: client.phone || "",
    email: client.email || "",
    inn: client.inn || "",
    kpp: client.kpp || "",
    ogrn: client.ogrn || "",
    telegram: client.telegram || "",
    whatsapp: client.whatsapp || "",
    legalAddress: client.legalAddress || "",
    postalAddress: client.postalAddress || "",
    bankName: client.bankName || "",
    bankAccount: client.bankAccount || "",
    bankBik: client.bankBik || "",
    corrAccount: client.corrAccount || "",
    source: client.source,
    notes: client.notes || "",
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil size={14} /> Редактировать
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Редактировать клиента" size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Тип клиента"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={[
                { value: "INDIVIDUAL", label: "Физическое лицо" },
                { value: "LEGAL", label: "Юридическое лицо" },
                { value: "IP", label: "ИП" },
              ]}
            />
            <Select
              label="Источник"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              options={[
                { value: "REFERRAL", label: "Рекомендация" },
                { value: "ADVERTISING", label: "Реклама" },
                { value: "COLD_CALL", label: "Звонок" },
                { value: "SOCIAL_MEDIA", label: "Соцсети" },
                { value: "OTHER", label: "Другое" },
              ]}
            />
          </div>
          <Input label="Имя / Название *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Telegram" value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} placeholder="@username" />
            <Input label="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </div>
          {form.type !== "INDIVIDUAL" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input label="ИНН" value={form.inn} onChange={(e) => setForm({ ...form, inn: e.target.value })} />
                <Input label="КПП" value={form.kpp} onChange={(e) => setForm({ ...form, kpp: e.target.value })} />
                <Input label="ОГРН" value={form.ogrn} onChange={(e) => setForm({ ...form, ogrn: e.target.value })} />
              </div>
              <Input label="Юридический адрес" value={form.legalAddress} onChange={(e) => setForm({ ...form, legalAddress: e.target.value })} />
              <Input label="Почтовый адрес" value={form.postalAddress} onChange={(e) => setForm({ ...form, postalAddress: e.target.value })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Банк" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                <Input label="БИК" value={form.bankBik} onChange={(e) => setForm({ ...form, bankBik: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Расчётный счёт" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} />
                <Input label="Корр. счёт" value={form.corrAccount} onChange={(e) => setForm({ ...form, corrAccount: e.target.value })} />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Примечания</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Отмена</Button>
            <Button type="submit" loading={loading}>Сохранить</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
