"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { CLIENT_TYPE_LABELS, CLIENT_SOURCE_LABELS } from "@/lib/constants";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Search, Phone, Mail, Users, Pencil, Trash2 } from "lucide-react";

interface ClientRow {
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
  bankName: string | null;
  bankAccount: string | null;
  bankBik: string | null;
  corrAccount: string | null;
  source: string;
  notes: string | null;
  createdAt: string;
  ordersCount: number;
  totalAmount: number;
}

const EMPTY_FORM = {
  type: "INDIVIDUAL",
  name: "",
  phone: "",
  email: "",
  inn: "",
  kpp: "",
  ogrn: "",
  telegram: "",
  whatsapp: "",
  legalAddress: "",
  bankName: "",
  bankAccount: "",
  bankBik: "",
  corrAccount: "",
  source: "OTHER",
  notes: "",
};

export default function ClientsClient({ initialData }: { initialData: ClientRow[] }) {
  const [clients, setClients] = useState(initialData);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const filtered = clients.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.inn?.includes(search);
    const matchType = !typeFilter || c.type === typeFilter;
    return matchSearch && matchType;
  });

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setCreateOpen(true);
  }

  function openEdit(client: ClientRow) {
    setForm({
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
      bankName: client.bankName || "",
      bankAccount: client.bankAccount || "",
      bankBik: client.bankBik || "",
      corrAccount: client.corrAccount || "",
      source: client.source,
      notes: client.notes || "",
    });
    setEditingClient(client);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const created = await res.json();
      setClients((prev) => [{ ...created, ordersCount: 0, totalAmount: 0 }, ...prev]);
      setCreateOpen(false);
    }
    setLoading(false);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClient) return;
    setLoading(true);
    const res = await fetch(`/api/clients/${editingClient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const updated = await res.json();
      setClients((prev) =>
        prev.map((c) =>
          c.id === editingClient.id
            ? { ...c, ...updated }
            : c
        )
      );
      setEditingClient(null);
    }
    setLoading(false);
  }

  async function handleDelete(client: ClientRow) {
    if (!confirm(`Удалить клиента «${client.name}»? Это удалит все связанные данные.`)) return;
    const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    if (res.ok) setClients((prev) => prev.filter((c) => c.id !== client.id));
  }

  function ClientForm({ onSubmit, submitLabel }: { onSubmit: (e: React.FormEvent) => void; submitLabel: string }) {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
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
        <Input
          label="Имя / Название *"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="ООО «Пример» или Иванов Иван"
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Телефон"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+7 (999) 000-00-00"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@example.com"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Telegram"
            value={form.telegram}
            onChange={(e) => setForm({ ...form, telegram: e.target.value })}
            placeholder="@username"
          />
          <Input
            label="WhatsApp"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            placeholder="+7..."
          />
        </div>
        {form.type !== "INDIVIDUAL" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="ИНН"
                value={form.inn}
                onChange={(e) => setForm({ ...form, inn: e.target.value })}
              />
              <Input
                label="КПП"
                value={form.kpp}
                onChange={(e) => setForm({ ...form, kpp: e.target.value })}
              />
              <Input
                label="ОГРН"
                value={form.ogrn}
                onChange={(e) => setForm({ ...form, ogrn: e.target.value })}
              />
            </div>
            <Input
              label="Юридический адрес"
              value={form.legalAddress}
              onChange={(e) => setForm({ ...form, legalAddress: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Банк"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              />
              <Input
                label="БИК"
                value={form.bankBik}
                onChange={(e) => setForm({ ...form, bankBik: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Расчётный счёт"
                value={form.bankAccount}
                onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
              />
              <Input
                label="Корр. счёт"
                value={form.corrAccount}
                onChange={(e) => setForm({ ...form, corrAccount: e.target.value })}
              />
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Примечания</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => { setCreateOpen(false); setEditingClient(null); }}
          >
            Отмена
          </Button>
          <Button type="submit" loading={loading}>{submitLabel}</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Клиенты</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{clients.length} клиент(ов) в базе</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Добавить клиента
        </Button>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Поиск по имени, телефону, email, ИНН..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:text-slate-500 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
          >
            <option value="">Все типы</option>
            <option value="INDIVIDUAL">Физическое лицо</option>
            <option value="LEGAL">Юридическое лицо</option>
            <option value="IP">ИП</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Клиент</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Тип</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Контакты</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Источник</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Заказов</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Оборот</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 dark:text-slate-500">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    Клиенты не найдены
                  </td>
                </tr>
              ) : (
                filtered.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/clients/${client.id}`} className="flex items-center gap-3 group">
                        <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/40 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                            {client.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 dark:text-slate-200 group-hover:text-violet-600 transition-colors">
                            {client.name}
                          </p>
                          {client.inn && (
                            <p className="text-xs text-gray-400 dark:text-slate-500">ИНН: {client.inn}</p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-full">
                        {CLIENT_TYPE_LABELS[client.type as keyof typeof CLIENT_TYPE_LABELS]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {client.phone && (
                          <p className="text-xs text-gray-600 dark:text-slate-400 flex items-center gap-1">
                            <Phone size={11} /> {client.phone}
                          </p>
                        )}
                        {client.email && (
                          <p className="text-xs text-gray-600 dark:text-slate-400 flex items-center gap-1">
                            <Mail size={11} /> {client.email}
                          </p>
                        )}
                        {!client.phone && !client.email && (
                          <span className="text-xs text-gray-400 dark:text-slate-500">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600 dark:text-slate-400">
                        {CLIENT_SOURCE_LABELS[client.source as keyof typeof CLIENT_SOURCE_LABELS]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-gray-700 dark:text-slate-200">{client.ordersCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-gray-800 dark:text-slate-200">
                        {formatCurrency(client.totalAmount)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(client)}
                          className="p-1.5 rounded hover:bg-violet-50 text-violet-500 transition-colors"
                          title="Редактировать"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(client)}
                          className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} title="Новый клиент">
        <ClientForm onSubmit={handleCreate} submitLabel="Создать клиента" />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editingClient} onClose={() => setEditingClient(null)} title="Редактировать клиента">
        <ClientForm onSubmit={handleUpdate} submitLabel="Сохранить" />
      </Modal>
    </div>
  );
}
