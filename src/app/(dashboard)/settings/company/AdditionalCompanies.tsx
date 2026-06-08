"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Building2, Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface Company {
  id: string;
  name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  phone: string;
  email: string;
  website: string;
  bankName: string;
  bankAccount: string;
  bankBik: string;
  corrAccount: string;
  director: string;
  accountant: string;
}

type CompanyForm = Omit<Company, "id">;

const EMPTY_FORM: CompanyForm = {
  name: "", inn: "", kpp: "", ogrn: "", legalAddress: "",
  phone: "", email: "", website: "", bankName: "", bankAccount: "",
  bankBik: "", corrAccount: "", director: "", accountant: "",
};

export default function AdditionalCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [fetching, setFetching] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [isOpen, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setFetching(true);
    const data = await fetch("/api/companies").then((r) => r.json());
    setCompanies(Array.isArray(data) ? data : []);
    setFetching(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(c: Company) {
    setEditingId(c.id);
    setForm({
      name: c.name, inn: c.inn, kpp: c.kpp, ogrn: c.ogrn, legalAddress: c.legalAddress,
      phone: c.phone, email: c.email, website: c.website, bankName: c.bankName,
      bankAccount: c.bankAccount, bankBik: c.bankBik, corrAccount: c.corrAccount,
      director: c.director, accountant: c.accountant,
    });
    setOpen(true);
  }

  function set(key: keyof CompanyForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(editingId ? `/api/companies/${editingId}` : "/api/companies", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setOpen(false);
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить компанию? У документов, выставленных от неё, останутся сохранённые данные.")) return;
    const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <Card padding="md">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-2">
          <Building2 size={16} /> Дополнительные компании
          {!fetching && companies.length > 0 && (
            <span className="text-xs font-normal text-gray-400 dark:text-slate-500">({companies.length})</span>
          )}
        </span>
        {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Доступны для выбора при создании счёта и акта. Основная компания берётся из реквизитов выше.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={openCreate} className="shrink-0">
              <Plus size={15} /> Добавить
            </Button>
          </div>

          {fetching ? (
            <p className="text-sm text-gray-400 dark:text-slate-500">Загрузка...</p>
          ) : companies.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-slate-500">Дополнительных компаний нет.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-700 border border-gray-100 dark:border-slate-700 rounded-lg">
              {companies.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{c.name || "Без названия"}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                      {[c.inn ? `ИНН ${c.inn}` : "", c.legalAddress].filter(Boolean).join(" · ") || "Реквизиты не заполнены"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => openEdit(c)} title="Редактировать"
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => handleDelete(c.id)} title="Удалить"
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={isOpen} onClose={() => setOpen(false)} title={editingId ? "Редактировать компанию" : "Новая компания"} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Название организации" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="ООО «Пример»" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="ИНН" value={form.inn} onChange={(e) => set("inn", e.target.value)} />
            <Input label="КПП" value={form.kpp} onChange={(e) => set("kpp", e.target.value)} />
            <Input label="ОГРН" value={form.ogrn} onChange={(e) => set("ogrn", e.target.value)} />
          </div>
          <Input label="Юридический адрес" value={form.legalAddress} onChange={(e) => set("legalAddress", e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Телефон" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            <Input label="Сайт" value={form.website} onChange={(e) => set("website", e.target.value)} />
          </div>
          <Input label="Наименование банка" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Расчётный счёт" value={form.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} />
            <Input label="БИК" value={form.bankBik} onChange={(e) => set("bankBik", e.target.value)} />
            <Input label="Корр. счёт" value={form.corrAccount} onChange={(e) => set("corrAccount", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Руководитель (ФИО)" value={form.director} onChange={(e) => set("director", e.target.value)} />
            <Input label="Бухгалтер (ФИО)" value={form.accountant} onChange={(e) => set("accountant", e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Отмена</Button>
            <Button type="submit" loading={saving} disabled={!form.name.trim()}>
              {editingId ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
