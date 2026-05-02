"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_TYPE_LABELS,
} from "@/lib/constants";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import {
  ArrowLeft, Send, CheckSquare, Clock, User, CreditCard, AlertCircle,
  Paperclip, Download, FileText, Image as ImageIcon, Upload,
  Pencil, Plus, Trash2, Check, X, UserPlus,
} from "lucide-react";
import Select from "@/components/ui/Select";

interface OrderFile {
  id: string;
  version: number;
  status: string;
  comment: string | null;
  createdAt: string;
  file: {
    id: string;
    key: string;
    originalName: string;
    size: number;
    mimeType: string;
    category: string;
    downloadUrl: string | null;
    uploadedBy: { id: string; name: string };
  };
}

interface OrderDetailClientProps {
  order: {
    id: string;
    number: string;
    status: string;
    type: string;
    priority: string;
    paymentStatus: string;
    amount: number;
    deadline: string | null;
    createdAt: string;
    updatedAt: string;
    notes: string | null;
    client: {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
    };
    manager: { id: string; name: string } | null;
    assignees: { id: string; name: string; role: string }[];
    files: OrderFile[];
    items: {
      id: string;
      name: string;
      qty: number;
      unit: string;
      price: number;
      discount: number;
      total: number;
      equipment: { name: string } | null;
    }[];
    comments: {
      id: string;
      text: string;
      createdAt: string;
      user: { id: string; name: string };
    }[];
    changeLogs: {
      id: string;
      field: string;
      oldValue: string | null;
      newValue: string | null;
      createdAt: string;
      user: { name: string };
    }[];
    tasks: {
      id: string;
      title: string;
      status: string;
      type: string;
      priority: string;
      dueDate: Date | null;
      assignee: { id: string; name: string } | null;
    }[];
  };
  users: { id: string; name: string; role: string }[];
  currentUserId: string;
  currentRole: string;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function OrderDetailClient({
  order: initialOrder,
  users,
  currentUserId,
  currentRole,
}: OrderDetailClientProps) {
  const [order, setOrder] = useState(initialOrder);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "files" | "tasks" | "comments" | "history">("items");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isDraggingTab, setIsDraggingTab] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const localPreviewsRef = useRef<Map<string, string>>(new Map());

  // Items edit state
  type EditItem = { id?: string; name: string; qty: number; unit: string; price: number; discount: number };
  const [editingItems, setEditingItems] = useState(false);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [savingItems, setSavingItems] = useState(false);

  // Assignees state
  const [addingAssignee, setAddingAssignee] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");

  // Task creation state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", type: "DESIGN", priority: "NORMAL", assigneeId: "", dueDate: "" });

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setTaskSaving(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...taskForm,
        orderId: order.id,
        assigneeId: taskForm.assigneeId || undefined,
        dueDate: taskForm.dueDate || undefined,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setOrder((prev) => ({ ...prev, tasks: [{ ...created, dueDate: created.dueDate ? new Date(created.dueDate) : null }, ...prev.tasks] }));
      setTaskModalOpen(false);
      setTaskForm({ title: "", type: "DESIGN", priority: "NORMAL", assigneeId: "", dueDate: "" });
    }
    setTaskSaving(false);
  }

  const canEdit = ["ADMIN", "MANAGER"].includes(currentRole);

  async function updateField(field: string, value: string) {
    setSaving(true);
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrder((prev) => ({ ...prev, ...updated }));
    }
    setSaving(false);
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommentLoading(true);
    const res = await fetch(`/api/orders/${order.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: commentText.trim() }),
    });
    if (res.ok) {
      const comment = await res.json();
      setOrder((prev) => ({
        ...prev,
        comments: [...prev.comments, { ...comment, createdAt: comment.createdAt }],
      }));
      setCommentText("");
    }
    setCommentLoading(false);
  }

  async function handleFileUpload(file: File, comment?: string) {
    setUploadingFile(true);
    try {
      const localUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      const res = await fetch(`/api/orders/${order.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          category: "SOURCES",
          ...(comment ? { comment } : {}),
        }),
      });
      if (!res.ok) return;
      const { orderFile, uploadUrl } = await res.json();
      if (uploadUrl) {
        try {
          await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        } catch { /* S3 upload failed — file record exists, binary may be missing */ }
      }
      if (localUrl) localPreviewsRef.current.set(orderFile.id, localUrl);
      setOrder((prev) => ({ ...prev, files: [orderFile, ...prev.files] }));
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (screenshotInputRef.current) screenshotInputRef.current.value = "";
    }
  }

  async function handleDropOnTab(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingTab(false);
    if (!canEdit) return;
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      await handleFileUpload(file, isImage ? "SCREENSHOT" : undefined).catch(() => {});
    }
  }

  useEffect(() => {
    if (activeTab !== "files") return;
    function handlePaste(e: ClipboardEvent) {
      if (!canEdit) return;
      const items = Array.from(e.clipboardData?.items || []);
      items
        .filter((item) => item.type.startsWith("image/"))
        .forEach((item) => {
          const blob = item.getAsFile();
          if (!blob) return;
          const ext = item.type.split("/")[1] || "png";
          const time = new Date().toLocaleTimeString("ru-RU").replace(/:/g, "-");
          const file = new File([blob], `скриншот_${time}.${ext}`, { type: item.type });
          handleFileUpload(file, "SCREENSHOT").catch(() => {});
        });
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeTab, canEdit]);

  async function handleDeleteFile(orderFileId: string) {
    if (!confirm("Удалить файл?")) return;
    const res = await fetch(`/api/orders/${order.id}/files?orderFileId=${orderFileId}`, { method: "DELETE" });
    if (res.ok) {
      setOrder((prev) => ({ ...prev, files: prev.files.filter((f) => f.id !== orderFileId) }));
    }
  }

  function startEditItems() {
    setEditItems(order.items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, unit: i.unit, price: i.price, discount: i.discount })));
    setEditingItems(true);
  }

  function updateEditItem(idx: number, field: keyof EditItem, value: string | number | boolean) {
    setEditItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function addEditItem() {
    setEditItems((prev) => [...prev, { name: "", qty: 1, unit: "шт", price: 0, discount: 0 }]);
  }

  function removeEditItem(idx: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveItems() {
    setSavingItems(true);
    const res = await fetch(`/api/orders/${order.id}/items`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: editItems.map((i) => ({ ...i, qty: Number(i.qty), price: Number(i.price), discount: Number(i.discount) })) }),
    });
    if (res.ok) {
      const data = await res.json();
      setOrder((prev) => ({ ...prev, items: data.items, amount: data.amount }));
      setEditingItems(false);
    }
    setSavingItems(false);
  }

  async function updateAssignees(newIds: string[]) {
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeIds: newIds }),
    });
    if (res.ok) {
      const updated = await res.json();
      const newAssignees = users.filter((u) => newIds.includes(u.id));
      setOrder((prev) => ({ ...prev, assignees: newAssignees, ...updated }));
    }
  }

  async function removeAssignee(userId: string) {
    const newIds = order.assignees.filter((a) => a.id !== userId).map((a) => a.id);
    await updateAssignees(newIds);
  }

  async function addAssignee() {
    if (!selectedAssigneeId) return;
    if (order.assignees.some((a) => a.id === selectedAssigneeId)) { setAddingAssignee(false); setSelectedAssigneeId(""); return; }
    const newIds = [...order.assignees.map((a) => a.id), selectedAssigneeId];
    await updateAssignees(newIds);
    setAddingAssignee(false);
    setSelectedAssigneeId("");
  }

  const editTotal = editItems.reduce((s, i) => s + Number(i.qty) * Number(i.price) * (1 - Number(i.discount) / 100), 0);

  const statusOptions = Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const typeOptions = Object.entries(ORDER_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const priorityOptions = Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const paymentOptions = Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Back + Header */}
      <div>
        <Link
          href="/orders"
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:text-slate-300 mb-3"
        >
          <ArrowLeft size={14} /> Все заявки
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{order.number}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_COLORS[order.status as keyof typeof ORDER_STATUS_COLORS]}`}>
                {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[order.priority as keyof typeof PRIORITY_COLORS]}`}>
                {PRIORITY_LABELS[order.priority as keyof typeof PRIORITY_LABELS]}
              </span>
              <span className="text-xs text-gray-400 dark:text-slate-500">· {formatDate(order.createdAt)}</span>
            </div>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Select
                value={order.status}
                onChange={(e) => updateField("status", e.target.value)}
                options={statusOptions}
              />
              <Select
                value={order.paymentStatus}
                onChange={(e) => updateField("paymentStatus", e.target.value)}
                options={paymentOptions}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - details */}
        <div className="space-y-4">
          {/* Client */}
          <Card padding="md">
            <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-3 flex items-center gap-2">
              <User size={15} /> Клиент
            </h2>
            <Link href={`/clients/${order.client.id}`} className="font-medium text-violet-600 hover:underline text-sm">
              {order.client.name}
            </Link>
            {order.client.phone && (
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{order.client.phone}</p>
            )}
          </Card>

          {/* Order info */}
          <Card padding="md">
            <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-3 flex items-center gap-2">
              <AlertCircle size={15} /> Параметры
            </h2>
            <dl className="space-y-2">
              {canEdit ? (
                <>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-slate-400 mb-1">Тип заявки</dt>
                    <Select
                      value={order.type}
                      onChange={(e) => updateField("type", e.target.value)}
                      options={typeOptions}
                    />
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-slate-400 mb-1">Приоритет</dt>
                    <Select
                      value={order.priority}
                      onChange={(e) => updateField("priority", e.target.value)}
                      options={priorityOptions}
                    />
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-slate-400 mb-1">Срок сдачи</dt>
                    <input
                      type="datetime-local"
                      value={order.deadline ? order.deadline.slice(0, 16) : ""}
                      onChange={(e) => updateField("deadline", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500 dark:text-slate-500">Тип</dt>
                    <dd className="text-gray-800 dark:text-slate-200">{ORDER_TYPE_LABELS[order.type as keyof typeof ORDER_TYPE_LABELS] ?? order.type}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500 dark:text-slate-500">Приоритет</dt>
                    <dd className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[order.priority as keyof typeof PRIORITY_COLORS]}`}>
                      {PRIORITY_LABELS[order.priority as keyof typeof PRIORITY_LABELS]}
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500 dark:text-slate-500">Срок сдачи</dt>
                    <dd className="text-gray-800 dark:text-slate-200">{formatDate(order.deadline)}</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500 dark:text-slate-500">Менеджер</dt>
                <dd className="text-gray-800 dark:text-slate-200">{order.manager?.name || "—"}</dd>
              </div>
            </dl>
          </Card>

          {/* Amount */}
          <Card padding="md">
            <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-3 flex items-center gap-2">
              <CreditCard size={15} /> Оплата
            </h2>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">{formatCurrency(order.amount)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[order.paymentStatus as keyof typeof PAYMENT_STATUS_COLORS]}`}>
                {PAYMENT_STATUS_LABELS[order.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS]}
              </span>
            </div>
          </Card>

          {/* Assignees */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-2">
                <User size={15} /> Исполнители
              </h2>
              {canEdit && !addingAssignee && (
                <button onClick={() => setAddingAssignee(true)} className="p-1 rounded hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-500 hover:text-violet-600 transition-colors">
                  <UserPlus size={15} />
                </button>
              )}
            </div>
            {order.assignees.length === 0 && !addingAssignee && (
              <p className="text-sm text-gray-400 dark:text-slate-500">Не назначены</p>
            )}
            {order.assignees.length > 0 && (
              <ul className="space-y-1 mb-2">
                {order.assignees.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-violet-100 dark:bg-violet-900/40 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-violet-600 dark:text-violet-400">{a.name.charAt(0)}</span>
                    </div>
                    <span className="text-sm text-gray-700 dark:text-slate-300 flex-1">{a.name}</span>
                    {canEdit && (
                      <button onClick={() => removeAssignee(a.id)} className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                        <X size={13} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {addingAssignee && (
              <div className="flex gap-1 mt-1">
                <select
                  value={selectedAssigneeId}
                  onChange={(e) => setSelectedAssigneeId(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                >
                  <option value="">— выбрать —</option>
                  {users.filter((u) => !order.assignees.some((a) => a.id === u.id)).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button onClick={addAssignee} disabled={!selectedAssigneeId} className="p-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40">
                  <Check size={13} />
                </button>
                <button onClick={() => { setAddingAssignee(false); setSelectedAssigneeId(""); }} className="p-1.5 rounded border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 dark:hover:bg-slate-700">
                  <X size={13} />
                </button>
              </div>
            )}
          </Card>

          {order.notes && (
            <Card padding="md">
              <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-2">Примечание</h2>
              <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-line">{order.notes}</p>
            </Card>
          )}
        </div>

        {/* Right column - tabs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-slate-700">
            {(["items", "files", "tasks", "comments", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-violet-600 text-violet-600"
                    : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300 dark:hover:text-slate-200"
                }`}
              >
                {{ items: "Позиции", files: "Файлы", tasks: "Задачи", comments: "Комментарии", history: "История" }[tab]}
                {tab === "files" && order.files.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded text-xs">{order.files.length}</span>
                )}
                {tab === "tasks" && order.tasks.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded text-xs">{order.tasks.length}</span>
                )}
                {tab === "comments" && order.comments.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded text-xs">{order.comments.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Items tab */}
          {activeTab === "items" && (
            <Card padding="none">
              {canEdit && (
                <div className="flex justify-end px-4 py-2 border-b border-gray-100 dark:border-slate-700">
                  {editingItems ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingItems(false)}>
                        <X size={13} /> Отмена
                      </Button>
                      <Button size="sm" onClick={saveItems} loading={savingItems}>
                        <Check size={13} /> Сохранить
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={startEditItems}>
                      <Pencil size={13} /> Редактировать
                    </Button>
                  )}
                </div>
              )}
              {!editingItems && order.items.length === 0 ? (
                <div className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">Позиций нет</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-slate-500 uppercase">Наименование</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-500 uppercase">Кол-во</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-500 uppercase">Цена</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-500 uppercase">Скидка%</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-slate-500 uppercase">Итого</th>
                      {editingItems && <th className="px-2 py-3 w-8"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                    {editingItems ? (
                      <>
                        {editItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">
                              <input
                                value={item.name}
                                onChange={(e) => updateEditItem(idx, "name", e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                                placeholder="Наименование"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex gap-1 items-center">
                                <input
                                  type="number" min="0.01" step="any" value={item.qty}
                                  onChange={(e) => updateEditItem(idx, "qty", parseFloat(e.target.value) || 0)}
                                  className="w-16 px-2 py-1 text-sm border border-gray-200 dark:border-slate-700 rounded text-right focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                                />
                                <input
                                  value={item.unit}
                                  onChange={(e) => updateEditItem(idx, "unit", e.target.value)}
                                  className="w-12 px-2 py-1 text-sm border border-gray-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                                />
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number" min="0" step="any" value={item.price}
                                onChange={(e) => updateEditItem(idx, "price", parseFloat(e.target.value) || 0)}
                                className="w-28 px-2 py-1 text-sm border border-gray-200 dark:border-slate-700 rounded text-right focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number" min="0" max="100" step="any" value={item.discount}
                                onChange={(e) => updateEditItem(idx, "discount", parseFloat(e.target.value) || 0)}
                                className="w-16 px-2 py-1 text-sm border border-gray-200 dark:border-slate-700 rounded text-right focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-gray-700 dark:text-slate-300">
                              {formatCurrency(Number(item.qty) * Number(item.price) * (1 - Number(item.discount) / 100))}
                            </td>
                            <td className="px-2 py-2">
                              <button
                                onClick={() => removeEditItem(idx)}
                                disabled={editItems.length <= 1}
                                className="p-1 rounded hover:bg-red-50 text-red-400 disabled:opacity-30"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={6} className="px-3 py-2">
                            <button onClick={addEditItem} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium">
                              <Plus size={13} /> Добавить позицию
                            </button>
                          </td>
                        </tr>
                        <tr className="bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-700">
                          <td colSpan={4} className="px-5 py-3 text-right font-semibold text-gray-700 dark:text-slate-300">Итого:</td>
                          <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-slate-100 text-base">{formatCurrency(editTotal)}</td>
                          <td></td>
                        </tr>
                      </>
                    ) : (
                      <>
                        {order.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-5 py-3 font-medium text-gray-800 dark:text-slate-200">{item.name}</td>
                            <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-400">{item.qty} {item.unit}</td>
                            <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-400">{formatCurrency(item.price)}</td>
                            <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-400">{item.discount}%</td>
                            <td className="px-5 py-3 text-right font-semibold text-gray-800 dark:text-slate-200">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-700">
                          <td colSpan={4} className="px-5 py-3 text-right font-semibold text-gray-700 dark:text-slate-300">Итого:</td>
                          <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-slate-100 text-base">{formatCurrency(order.amount)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {/* Files tab */}
          {activeTab === "files" && (
            <div
              className={`space-y-4 relative rounded-xl transition-colors ${isDraggingTab ? "ring-2 ring-violet-400 ring-offset-2" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingTab(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingTab(false); }}
              onDrop={handleDropOnTab}
            >
              {isDraggingTab && (
                <div className="absolute inset-0 z-10 rounded-xl border-2 border-dashed border-violet-400 bg-violet-50/90 dark:bg-violet-900/50 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <Upload size={28} className="mx-auto mb-1 text-violet-500" />
                    <p className="text-sm font-medium text-violet-600">Отпустите для загрузки</p>
                    <p className="text-xs text-violet-400">Изображения → скрин-превью, остальное → файлы</p>
                  </div>
                </div>
              )}

              {/* Hidden inputs */}
              <input ref={fileInputRef} type="file" multiple hidden
                onChange={(e) => { Array.from(e.target.files || []).forEach((f) => handleFileUpload(f)); }} />
              <input ref={screenshotInputRef} type="file" multiple accept="image/*" hidden
                onChange={(e) => { Array.from(e.target.files || []).forEach((f) => handleFileUpload(f, "SCREENSHOT")); }} />

              {/* Action buttons */}
              {canEdit && (
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => screenshotInputRef.current?.click()}>
                    <ImageIcon size={13} /> Добавить скрин
                  </Button>
                  <Button type="button" variant="outline" size="sm" loading={uploadingFile} onClick={() => fileInputRef.current?.click()}>
                    <Upload size={13} /> Загрузить файл
                  </Button>
                </div>
              )}

              {/* Screenshots section */}
              {(() => {
                const screenshots = order.files.filter((f) => f.comment === "SCREENSHOT");
                if (screenshots.length === 0) return null;
                return (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-slate-500 uppercase mb-2">Скрин-превью</p>
                    <div className="grid grid-cols-2 gap-2">
                      {screenshots.map((of) => {
                        const previewUrl = localPreviewsRef.current.get(of.id) || of.file.downloadUrl;
                        return (
                          <div key={of.id} className="relative group rounded-lg overflow-hidden border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                            {previewUrl ? (
                              <img src={previewUrl} alt={of.file.originalName} className="w-full object-contain max-h-48" />
                            ) : (
                              <div className="h-32 flex items-center justify-center text-gray-300">
                                <ImageIcon size={32} />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/40 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-xs text-white truncate">{of.file.originalName}</span>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {of.file.downloadUrl && (
                                  <a href={of.file.downloadUrl} target="_blank" rel="noreferrer"
                                    className="p-0.5 rounded bg-white dark:bg-slate-800/20 hover:bg-white dark:bg-slate-800/40 text-white">
                                    <Download size={12} />
                                  </a>
                                )}
                                {canEdit && (
                                  <button onClick={() => handleDeleteFile(of.id)}
                                    className="p-0.5 rounded bg-white dark:bg-slate-800/20 hover:bg-red-500/80 text-white">
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Regular files section */}
              {(() => {
                const regularFiles = order.files.filter((f) => f.comment !== "SCREENSHOT");
                const isEmpty = order.files.length === 0;
                return (
                  <Card padding="none">
                    {isEmpty ? (
                      <div className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                        <Paperclip size={28} className="mx-auto mb-2 opacity-30" />
                        <p>Файлов нет</p>
                        {canEdit && <p className="text-xs mt-1 text-gray-300">Перетащите сюда или нажмите Ctrl+V для скриншота</p>}
                      </div>
                    ) : regularFiles.length === 0 ? (
                      <div className="py-6 text-center text-gray-400 dark:text-slate-500 text-sm">
                        <p className="text-xs text-gray-300">Файлов нет — только скрины выше</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50 dark:divide-slate-700">
                        {regularFiles.map((of) => (
                          <div key={of.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 transition-colors">
                            <FileText size={18} className="shrink-0 text-gray-400 dark:text-slate-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{of.file.originalName}</p>
                              <p className="text-xs text-gray-400 dark:text-slate-500">
                                {formatFileSize(of.file.size)} · v{of.version} · {of.file.uploadedBy.name} · {formatDate(of.createdAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {of.file.downloadUrl && (
                                <a href={of.file.downloadUrl} target="_blank" rel="noreferrer">
                                  <Button type="button" variant="outline" size="sm"><Download size={13} /></Button>
                                </a>
                              )}
                              {canEdit && (
                                <Button type="button" variant="outline" size="sm" onClick={() => handleDeleteFile(of.id)}>
                                  <span className="text-red-500 text-xs">✕</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })()}
            </div>
          )}

          {/* Tasks tab */}
          {activeTab === "tasks" && (
            <div className="space-y-3">
              {canEdit && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setTaskModalOpen(true)}>
                    <Plus size={14} /> Создать задачу
                  </Button>
                </div>
              )}
              <Card padding="none">
                {order.tasks.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                    <CheckSquare size={28} className="mx-auto mb-2 opacity-30" />
                    Задач нет
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-slate-700">
                    {order.tasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/tasks/${task.id}`}
                        className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-gray-800 dark:text-slate-200 text-sm">{task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400 dark:text-slate-500">{TASK_TYPE_LABELS[task.type as keyof typeof TASK_TYPE_LABELS]}</span>
                            {task.assignee && (
                              <span className="text-xs text-gray-400 dark:text-slate-500">· {task.assignee.name}</span>
                            )}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TASK_STATUS_COLORS[task.status as keyof typeof TASK_STATUS_COLORS]}`}>
                          {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Comments tab */}
          {activeTab === "comments" && (
            <div className="space-y-3">
              <Card padding="none">
                <div className="divide-y divide-gray-50 dark:divide-slate-700">
                  {order.comments.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 dark:text-slate-500 text-sm">Комментариев нет</div>
                  ) : (
                    order.comments.map((c) => (
                      <div key={c.id} className={`px-5 py-3 ${c.user.id === currentUserId ? "bg-violet-50 dark:bg-violet-900/20" : ""}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{c.user.name}</span>
                          <span className="text-xs text-gray-400 dark:text-slate-500">{formatDateTime(c.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-line">{c.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
              <form onSubmit={sendComment} className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Написать комментарий..."
                  className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                />
                <Button type="submit" loading={commentLoading} disabled={!commentText.trim()}>
                  <Send size={14} />
                </Button>
              </form>
            </div>
          )}

          {/* History tab */}
          {activeTab === "history" && (
            <Card padding="none">
              {order.changeLogs.length === 0 ? (
                <div className="py-8 text-center text-gray-400 dark:text-slate-500 text-sm">Изменений нет</div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-slate-700">
                  {order.changeLogs.map((log) => (
                    <div key={log.id} className="px-5 py-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mb-0.5">
                        <Clock size={11} />
                        <span>{formatDateTime(log.createdAt)}</span>
                        <span>·</span>
                        <span className="font-medium text-gray-700 dark:text-slate-300">{log.user.name}</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-slate-300">
                        Изменил <span className="font-medium">{log.field}</span>
                        {log.oldValue && (
                          <> с <span className="text-red-600">{log.oldValue}</span></>
                        )}
                        {log.newValue && (
                          <> на <span className="text-green-600">{log.newValue}</span></>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Create Task Modal */}
      <Modal isOpen={taskModalOpen} onClose={() => setTaskModalOpen(false)} title="Новая задача" size="md">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input
            label="Название *"
            required
            value={taskForm.title}
            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
            placeholder="Что нужно сделать?"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Тип задачи"
              value={taskForm.type}
              onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })}
              options={Object.entries(TASK_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
            <Select
              label="Приоритет"
              value={taskForm.priority}
              onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
              options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
          </div>
          <Select
            label="Исполнитель"
            value={taskForm.assigneeId}
            onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
            placeholder="Выберите исполнителя"
            options={users.map((u) => ({ value: u.id, label: u.name }))}
          />
          <Input
            label="Срок выполнения"
            type="datetime-local"
            value={taskForm.dueDate}
            onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setTaskModalOpen(false)}>Отмена</Button>
            <Button type="submit" loading={taskSaving}>Создать задачу</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
