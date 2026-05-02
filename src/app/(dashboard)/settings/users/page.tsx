"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Plus, Shield, ShieldOff, Trash2, Users, Pencil, Send } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  telegramChatId: string | null;
  isBlocked: boolean;
  createdAt: string;
}

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState({
    email: "", password: "", name: "", role: "MANAGER",
    phone: "", telegramChatId: "",
  });

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "", phone: "", telegramChatId: "" });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        phone: form.phone || undefined,
        telegramChatId: form.telegramChatId || undefined,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setUsers((prev) => [...prev, created]);
      setModalOpen(false);
      setForm({ email: "", password: "", name: "", role: "MANAGER", phone: "", telegramChatId: "" });
    }
    setCreateLoading(false);
  }

  function openEdit(user: User) {
    setEditUser(user);
    setEditForm({
      name: user.name,
      role: user.role,
      phone: user.phone || "",
      telegramChatId: user.telegramChatId || "",
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditLoading(true);
    const res = await fetch(`/api/users/${editUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        role: editForm.role,
        phone: editForm.phone || null,
        telegramChatId: editForm.telegramChatId || null,
      }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) =>
        u.id === editUser.id
          ? { ...u, ...editForm, phone: editForm.phone || null, telegramChatId: editForm.telegramChatId || null }
          : u
      ));
      setEditUser(null);
    }
    setEditLoading(false);
  }

  async function toggleBlock(id: string, isBlocked: boolean) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBlocked: !isBlocked }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isBlocked: !isBlocked } : u)));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить пользователя?")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  if (loading) return <div className="p-6 text-gray-400 dark:text-slate-500">Загрузка...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Users size={22} /> Пользователи
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{users.length} пользователей</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Добавить пользователя
        </Button>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Пользователь</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Роль</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Telegram</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Статус</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Добавлен</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
            {users.map((user) => (
              <tr key={user.id} className={`hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 ${user.isBlocked ? "opacity-60" : ""}`}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/40 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-violet-600 dark:text-violet-400">{user.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 dark:text-slate-200">{user.name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 bg-violet-50 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 rounded-full font-medium">
                    {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                  {user.telegramChatId ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <Send size={11} /> {user.telegramChatId}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.isBlocked ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"}`}>
                    {user.isBlocked ? "Заблокирован" : "Активен"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(user)}
                      className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-50 transition-colors"
                      title="Редактировать"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => toggleBlock(user.id, user.isBlocked)}
                      className={`p-1.5 rounded-lg transition-colors ${user.isBlocked ? "text-green-600 hover:bg-green-50" : "text-orange-500 hover:bg-orange-50"}`}
                      title={user.isBlocked ? "Разблокировать" : "Заблокировать"}
                    >
                      {user.isBlocked ? <Shield size={14} /> : <ShieldOff size={14} />}
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Редактировать пользователя" size="md">
        <form onSubmit={handleEdit} className="space-y-4">
          <Input label="Имя *" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <Select
            label="Роль"
            value={editForm.role}
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            options={Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Телефон" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            <div>
              <Input
                label="Telegram Chat ID"
                value={editForm.telegramChatId}
                onChange={(e) => setEditForm({ ...editForm, telegramChatId: e.target.value })}
                placeholder="123456789"
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Узнать ID: написать <span className="font-medium text-gray-500 dark:text-slate-500">@userinfobot</span> в Telegram
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setEditUser(null)}>Отмена</Button>
            <Button type="submit" loading={editLoading}>Сохранить</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Новый пользователь" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Имя *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email *" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Пароль *" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select
            label="Роль"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Telegram Chat ID" value={form.telegramChatId} onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button type="submit" loading={createLoading}>Создать</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
