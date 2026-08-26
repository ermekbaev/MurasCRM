"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { Users, Plus, Pencil, Trash2, Phone, Mail, Send, MessageCircle } from "lucide-react";

export interface Contact {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  whatsapp: string | null;
  note: string | null;
}

const EMPTY = { name: "", position: "", phone: "", email: "", telegram: "", whatsapp: "", note: "" };

export default function ClientContacts({
  clientId,
  initial,
  canEdit,
}: {
  clientId: string;
  initial: Contact[];
  canEdit: boolean;
}) {
  const [contacts, setContacts] = useState<Contact[]>(initial);
  const [isOpen, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  }

  function openEdit(c: Contact) {
    setEditing(c);
    setForm({
      name: c.name,
      position: c.position || "",
      phone: c.phone || "",
      email: c.email || "",
      telegram: c.telegram || "",
      whatsapp: c.whatsapp || "",
      note: c.note || "",
    });
    setError(null);
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Укажите имя контакта");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editing
        ? `/api/clients/${clientId}/contacts/${editing.id}`
        : `/api/clients/${clientId}/contacts`;
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const fieldErrors = body?.error?.fieldErrors as Record<string, string[]> | undefined;
        setError(fieldErrors?.email ? "Email указан неверно" : "Не удалось сохранить контакт");
        return;
      }
      const saved: Contact = await res.json();
      setContacts((prev) =>
        editing ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved],
      );
      setOpen(false);
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Contact) {
    if (!confirm(`Удалить контакт «${c.name}»?`)) return;
    const res = await fetch(`/api/clients/${clientId}/contacts/${c.id}`, { method: "DELETE" });
    if (res.ok) setContacts((prev) => prev.filter((x) => x.id !== c.id));
  }

  return (
    <Card padding="md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-fg">
          <Users size={16} /> Контактные лица
        </h2>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus size={14} /> Добавить
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-fg-subtle">
          Сотрудники клиента не добавлены
        </p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {contacts.map((c) => (
            <li key={c.id} className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs font-semibold text-accent-fg ring-1 ring-inset ring-accent/15">
                {c.name.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{c.name}</p>
                {c.position && <p className="text-xs text-fg-subtle">{c.position}</p>}

                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent">
                      <Phone size={12} /> {c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent">
                      <Mail size={12} /> {c.email}
                    </a>
                  )}
                  {c.telegram && (
                    <a
                      href={`https://t.me/${c.telegram.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent"
                    >
                      <Send size={12} /> {c.telegram}
                    </a>
                  )}
                  {c.whatsapp && (
                    <a
                      href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-green-600"
                    >
                      <MessageCircle size={12} /> {c.whatsapp}
                    </a>
                  )}
                </div>

                {c.note && <p className="mt-1.5 text-xs text-fg-subtle">{c.note}</p>}
              </div>

              {canEdit && (
                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(c)}
                    title="Редактировать"
                    className="rounded p-1.5 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-accent"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    title="Удалить"
                    className="rounded p-1.5 text-fg-subtle transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        title={editing ? "Контактное лицо" : "Новое контактное лицо"}
        description="Сотрудник клиента, с которым ведутся дела"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? "Сохранить" : "Добавить"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Имя *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Иванов Иван"
            />
            <Input
              label="Должность"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              placeholder="Снабженец"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Телефон"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+7 (999) 000-00-00"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Telegram"
              value={form.telegram}
              onChange={(e) => setForm((f) => ({ ...f, telegram: e.target.value }))}
              placeholder="@username"
            />
            <Input
              label="WhatsApp"
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              placeholder="+7..."
            />
          </div>
          <Input
            label="Заметка"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Согласовывает макеты, звонить после 11:00"
          />
        </div>
      </Modal>
    </Card>
  );
}
