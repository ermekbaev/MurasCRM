"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { formatCurrency, formatDate, formatFileSize } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
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
import { Plus, Search, ShoppingCart, AlertTriangle, Trash2, Paperclip, X, FileText } from "lucide-react";
import { Role } from "@prisma/client";

interface Order {
  id: string;
  number: string;
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

interface Service {
  id: string;
  name: string;
  unit: string;
  price: number;
}

interface FormItem {
  serviceId: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  discount: number;
}

interface Props {
  initialOrders: Order[];
  clients: Client[];
  users: User[];
  services: Service[];
  currentUserId: string;
  currentRole: string;
}

const emptyItem = (): FormItem => ({ serviceId: "", name: "", qty: 1, unit: "шт", price: 0, discount: 0 });

export default function OrdersClient({ initialOrders, clients, users, services, currentUserId, currentRole }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formItems, setFormItems] = useState<FormItem[]>([emptyItem()]);
  const [form, setForm] = useState({
    clientId: "",
    priority: "NORMAL",
    deadline: "",
    notes: "",
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Map<string, string>>(new Map());

  function fileKey(f: File) { return `${f.name}-${f.size}-${f.lastModified}`; }

  function getPreviewUrl(f: File): string {
    const k = fileKey(f);
    if (!previewUrlsRef.current.has(k)) {
      previewUrlsRef.current.set(k, URL.createObjectURL(f));
    }
    return previewUrlsRef.current.get(k)!;
  }

  function addFiles(incoming: File[]) {
    setPendingFiles((prev) => {
      const existingKeys = new Set(prev.map(fileKey));
      return [...prev, ...incoming.filter((f) => !existingKeys.has(fileKey(f)))];
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files || []));
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  useEffect(() => {
    if (!isModalOpen) return;
    function handlePaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items || []);
      const images = items
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => {
          const blob = item.getAsFile();
          if (!blob) return null;
          const ext = item.type.split("/")[1] || "png";
          const time = new Date().toLocaleTimeString("ru-RU").replace(/:/g, "-");
          return new File([blob], `скриншот_${time}.${ext}`, { type: item.type });
        })
        .filter(Boolean) as File[];
      if (images.length > 0) addFiles(images);
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isModalOpen]);

  function closeModal() {
    setModalOpen(false);
    setForm({ clientId: "", priority: "NORMAL", deadline: "", notes: "" });
    setFormItems([emptyItem()]);
    setPendingFiles([]);
    setUploadProgress({ done: 0, total: 0 });
  }

  function updateItem(idx: number, patch: Partial<FormItem>) {
    setFormItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  function handleItemName(idx: number, value: string) {
    const svc = services.find((s) => s.name === value);
    if (svc) {
      updateItem(idx, { name: value, serviceId: svc.id, unit: svc.unit, price: svc.price });
    } else {
      updateItem(idx, { name: value, serviceId: "" });
    }
  }

  const itemsTotal = formItems.reduce(
    (s, i) => s + Number(i.qty) * Number(i.price) * (1 - Number(i.discount) / 100),
    0
  );

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
    const matchPriority = !priorityFilter || o.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId) return;
    setLoading(true);
    const validItems = formItems.filter((i) => i.name.trim());
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        items: validItems.map((i) => ({
          serviceId: i.serviceId || undefined,
          name: i.name,
          qty: Number(i.qty),
          unit: i.unit,
          price: Number(i.price),
          discount: Number(i.discount),
        })),
      }),
    });
    if (res.ok) {
      const created = await res.json();

      if (pendingFiles.length > 0) {
        setUploadProgress({ done: 0, total: pendingFiles.length });
        for (const file of pendingFiles) {
          try {
            const metaRes = await fetch(`/api/orders/${created.id}/files`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                originalName: file.name,
                mimeType: file.type || "application/octet-stream",
                size: file.size,
                category: "SOURCES",
              }),
            });
            if (metaRes.ok) {
              const { uploadUrl } = await metaRes.json();
              await fetch(uploadUrl, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": file.type || "application/octet-stream" },
              });
            }
          } catch { /* file can be added later from order detail */ }
          setUploadProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      }

      setOrders((prev) => [
        {
          ...created,
          amount: Number(created.amount),
          createdAt: created.createdAt,
          deadline: created.deadline,
          _count: { items: validItems.length, tasks: 0 },
        },
        ...prev,
      ]);
      closeModal();
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
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                    Заявки не найдены
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/orders/${order.id}`} className="group">
                        <p className="font-medium text-gray-800 group-hover:text-violet-600 transition-colors truncate max-w-48">
                          {order.client.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {order.number}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(order.createdAt)}
                        </p>
                      </Link>
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
      <Modal isOpen={isModalOpen} onClose={closeModal} title="Новая заявка" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select
            label="Приоритет"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
          <Select
            label="Клиент *"
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            placeholder="Выберите клиента"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
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
          {/* Позиции */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Позиции</label>
              {itemsTotal > 0 && (
                <span className="text-sm font-semibold text-violet-700">
                  Итого: {itemsTotal.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} сом
                </span>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Наименование</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 w-14">Кол-во</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 w-12">Ед.</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 w-20">Цена</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 w-16">Скидка%</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 w-20">Сумма</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {formItems.map((item, idx) => {
                    const lineTotal = Number(item.qty) * Number(item.price) * (1 - Number(item.discount) / 100);
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-3 py-1.5">
                          <input
                            value={item.name}
                            onChange={(e) => handleItemName(idx, e.target.value)}
                            placeholder="Название..."
                            list={`svc-list-${idx}`}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                          <datalist id={`svc-list-${idx}`}>
                            {services.map((s) => (
                              <option key={s.id} value={s.name} />
                            ))}
                          </datalist>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0.01" step="any" value={item.qty}
                            onChange={(e) => updateItem(idx, { qty: parseFloat(e.target.value) || 1 })}
                            className="w-full px-1 py-1 text-sm border border-gray-200 rounded text-center focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={item.unit}
                            onChange={(e) => updateItem(idx, { unit: e.target.value })}
                            className="w-full px-1 py-1 text-sm border border-gray-200 rounded text-center focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0" step="any" value={item.price}
                            onChange={(e) => updateItem(idx, { price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-1 py-1 text-sm border border-gray-200 rounded text-right focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0" max="100" step="any" value={item.discount}
                            onChange={(e) => updateItem(idx, { discount: parseFloat(e.target.value) || 0 })}
                            className="w-full px-1 py-1 text-sm border border-gray-200 rounded text-right focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right text-sm font-medium text-gray-700 whitespace-nowrap">
                          {lineTotal > 0 ? lineTotal.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) : "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => setFormItems((p) => p.filter((_, i) => i !== idx))}
                            disabled={formItems.length <= 1}
                            className="p-1 rounded text-red-400 hover:bg-red-50 disabled:opacity-30 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setFormItems((p) => [...p, emptyItem()])}
              className="mt-2 flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium"
            >
              <Plus size={13} /> Добавить позицию
            </button>
          </div>

          {/* Files */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Файлы</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium"
              >
                <Paperclip size={12} /> Прикрепить файл
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={handleFileSelect}
            />
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => pendingFiles.length === 0 && fileInputRef.current?.click()}
              className={`rounded-lg border-2 border-dashed transition-colors ${
                isDragging
                  ? "border-violet-400 bg-violet-50"
                  : pendingFiles.length === 0
                  ? "border-gray-200 hover:border-violet-300 cursor-pointer"
                  : "border-gray-200"
              }`}
            >
              {pendingFiles.length > 0 ? (
                <div className="p-2 space-y-1.5">
                  {pendingFiles.map((f, idx) => {
                    const isImage = f.type.startsWith("image/");
                    return (
                      <div key={idx} className="relative group rounded-md border border-gray-100 bg-white overflow-hidden">
                        {isImage ? (
                          <div className="relative">
                            <img
                              src={getPreviewUrl(f)}
                              alt={f.name}
                              className="w-full max-h-48 object-contain bg-gray-50"
                            />
                            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/40 flex items-center justify-between">
                              <span className="text-xs text-white truncate">{f.name}</span>
                              <span className="text-xs text-white/70 shrink-0 ml-2">{formatFileSize(f.size)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between px-3 py-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText size={13} className="text-gray-400 shrink-0" />
                              <span className="text-xs text-gray-700 truncate">{f.name}</span>
                              <span className="text-xs text-gray-400 shrink-0">{formatFileSize(f.size)}</span>
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPendingFiles((p) => p.filter((_, i) => i !== idx)); }}
                          className="absolute top-1 right-1 p-0.5 rounded bg-white/80 text-gray-500 hover:text-red-500 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="w-full py-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium"
                  >
                    + Добавить ещё
                  </button>
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center gap-1.5 text-gray-400 select-none">
                  <Paperclip size={18} className={isDragging ? "text-violet-500" : ""} />
                  <p className="text-xs">Перетащите файлы или нажмите чтобы выбрать</p>
                  <p className="text-xs text-gray-300">Скриншот — Ctrl+V</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={closeModal} disabled={loading}>
              Отмена
            </Button>
            <Button type="submit" loading={loading} disabled={!form.clientId}>
              {loading && uploadProgress.total > 0
                ? `Загрузка файлов ${uploadProgress.done}/${uploadProgress.total}...`
                : "Создать заявку"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
