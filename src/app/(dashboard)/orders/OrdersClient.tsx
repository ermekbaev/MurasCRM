"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from "@/lib/constants";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Search, ShoppingCart, Calendar, AlertTriangle } from "lucide-react";
import { Role } from "@prisma/client";

interface Order {
  id: string;
  number: string;
  type: string;
  status: string;
  priority: string;
  paymentStatus: string;
  amount: number;
  deadline: string | null;
  createdAt: string;
  client: { id: string; name: string };
  manager: { id: string; name: string } | null;
  assignees: { id: string; name: string }[];
  _count: { items: number; tasks: number };
}

interface Client {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  role: string;
}

interface Equipment {
  id: string;
  name: string;
  type: string;
}

interface Props {
  initialOrders: Order[];
  clients: Client[];
  users: User[];
  equipment: Equipment[];
  currentUserId: string;
  currentRole: string;
}

export default function OrdersClient({ initialOrders, clients, users, equipment, currentUserId, currentRole }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: "DTF",
    clientId: "",
    priority: "NORMAL",
    deadline: "",
    notes: "",
    equipmentId: "",
  });

  const filtered = orders.filter((o) => {
    const matchSearch =
      !search ||
      o.number.toLowerCase().includes(search.toLowerCase()) ||
      o.client.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      !statusFilter ||
      (statusFilter === "active" && ["NEW", "IN_PROGRESS", "REVIEW"].includes(o.status)) ||
      (statusFilter === "completed" && ["READY", "ISSUED"].includes(o.status)) ||
      o.status === statusFilter;
    const matchType = !typeFilter || o.type === typeFilter;
    const matchPriority = !priorityFilter || o.priority === priorityFilter;
    return matchSearch && matchStatus && matchType && matchPriority;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId) return;
    setLoading(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const created = await res.json();
      setOrders((prev) => [
        {
          ...created,
          amount: Number(created.amount),
          createdAt: created.createdAt,
          deadline: created.deadline,
          _count: { items: 0, tasks: 0 },
        },
        ...prev,
      ]);
      setModalOpen(false);
      setForm({ type: "DTF", clientId: "", priority: "NORMAL", deadline: "", notes: "", equipmentId: "" });
    }
    setLoading(false);
  }

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Заявки</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} из {orders.length}</p>
        </div>
        {["ADMIN", "MANAGER"].includes(currentRole) && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Новая заявка
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по номеру или клиенту..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          >
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="completed">Завершённые</option>
            <option value="NEW">Новые</option>
            <option value="IN_PROGRESS">В работе</option>
            <option value="REVIEW">На проверке</option>
            <option value="READY">Готово</option>
            <option value="ISSUED">Выдано</option>
            <option value="CANCELLED">Отменено</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          >
            <option value="">Все типы</option>
            {Object.entries(ORDER_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          >
            <option value="">Все приоритеты</option>
            {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Заявка</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Тип</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Приоритет</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Срок</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Оплата</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                    Заявки не найдены
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/orders/${order.id}`} className="group">
                        <p className="font-medium text-gray-800 group-hover:text-violet-600 transition-colors">
                          {order.number}
                        </p>
                        <p className="text-xs text-gray-400 truncate max-w-40">
                          {order.client.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(order.createdAt)}
                        </p>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600">
                        {ORDER_TYPE_LABELS[order.type as keyof typeof ORDER_TYPE_LABELS]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_COLORS[order.status as keyof typeof ORDER_STATUS_COLORS]}`}>
                        {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[order.priority as keyof typeof PRIORITY_COLORS]}`}>
                        {PRIORITY_LABELS[order.priority as keyof typeof PRIORITY_LABELS]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.deadline ? (
                        <div className={`flex items-center gap-1 ${isOverdue(order.deadline) && !["READY", "ISSUED"].includes(order.status) ? "text-red-600" : "text-gray-600"}`}>
                          {isOverdue(order.deadline) && !["READY", "ISSUED"].includes(order.status) && (
                            <AlertTriangle size={12} />
                          )}
                          <span className="text-xs">{formatDate(order.deadline)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[order.paymentStatus as keyof typeof PAYMENT_STATUS_COLORS]}`}>
                        {PAYMENT_STATUS_LABELS[order.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-semibold text-gray-800">{formatCurrency(order.amount)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Новая заявка" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Тип работы *"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={Object.entries(ORDER_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
            <Select
              label="Приоритет"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
          </div>
          <Select
            label="Клиент *"
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            placeholder="Выберите клиента"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
          {equipment.length > 0 && (
            <Select
              label="Оборудование"
              value={form.equipmentId}
              onChange={(e) => setForm({ ...form, equipmentId: e.target.value })}
              placeholder="Не выбрано"
              options={equipment.map((eq) => ({ value: eq.id, label: `${eq.name} (${eq.type})` }))}
            />
          )}
          <Input
            label="Срок сдачи"
            type="datetime-local"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Примечание</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Комментарий к заявке..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" loading={loading} disabled={!form.clientId}>
              Создать заявку
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
