"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  TASK_TYPE_LABELS,
} from "@/lib/constants";
import { useTaskColumns } from "@/hooks/useTaskColumns";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import {
  ArrowLeft, Send, CheckSquare, Clock, User, CreditCard, AlertCircle,
  Paperclip, Download, FileText, Image as ImageIcon, Upload,
  Pencil, Plus, Trash2, Check, X, UserPlus,
  ClipboardList, FileSpreadsheet, ArrowUpRight,
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
    title: string | null;
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
    invoices: { id: string; number: string; date: string; total: number; isPaid: boolean }[];
    acts: { id: string; number: string; date: string; total: number }[];
    waybills: { id: string; number: string; date: string; total: number }[];
  };
  users: { id: string; name: string; role: string }[];
  orderTypes: { code: string; label: string; isActive: boolean }[];
  currentUserId: string;
  currentRole: string;
}

interface DocumentRow {
  id: string;
  number: string;
  date: string;
  total: number;
  badge?: string | null;
}

/** Список связанных с заявкой документов одного типа. */
function DocumentList({
  title,
  icon,
  href,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  items: DocumentRow[];
  empty: string;
}) {
  return (
    <Card padding="none">
      <div className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
        <span className="text-fg-subtle">{icon}</span>
        <h3 className="text-[13px] font-semibold text-fg">{title}</h3>
        <span className="ml-auto text-xs text-fg-subtle">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-fg-subtle">{empty}</p>
      ) : (
        <div className="divide-y divide-line-soft">
          {items.map((d) => (
            <Link
              key={d.id}
              href={`${href}/${d.id}`}
              className="group flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
                  {d.number}
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                </p>
                <p className="text-xs text-fg-subtle">{formatDate(d.date)}</p>
              </div>
              {d.badge && (
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
                  {d.badge}
                </span>
              )}
              <span className="text-sm font-medium text-fg tabular-nums">
                {formatCurrency(d.total)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function OrderDetailClient({
  order: initialOrder,
  users,
  orderTypes,
  currentUserId,
  currentRole,
}: OrderDetailClientProps) {
  const { labels: taskStatusLabels, colors: taskStatusColors } = useTaskColumns();
  const [order, setOrder] = useState(initialOrder);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "files" | "tasks" | "docs" | "comments" | "history">("items");
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const docsCount = order.invoices.length + order.acts.length + order.waybills.length;
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isDraggingTab, setIsDraggingTab] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
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

  async function saveTitle() {
    await updateField("title", titleDraft.trim());
    setEditingTitle(false);
  }

  /**
   * Счёт из позиций заявки: клиент и позиции берутся отсюда, счёт остаётся
   * привязанным к заявке. Скидка позиции уже учтена в её сумме, поэтому в счёт
   * уходит фактическая цена (total / qty) — иначе итог счёта разошёлся бы с заявкой.
   */
  async function createInvoiceFromOrder() {
    if (order.items.length === 0) {
      setDocsError("В заявке нет позиций — сначала добавьте их на вкладке «Позиции»");
      return;
    }
    setCreatingInvoice(true);
    setDocsError(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: order.client.id,
          orderId: order.id,
          basis: `Заявка № ${order.number}`,
          items: order.items.map((i) => ({
            name: i.name,
            qty: Number(i.qty),
            unit: i.unit,
            price: Number(i.qty) > 0 ? Number(i.total) / Number(i.qty) : Number(i.price),
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setDocsError(typeof body?.error === "string" ? body.error : "Не удалось создать счёт");
        return;
      }
      const invoice = await res.json();
      window.location.href = `/invoices/${invoice.id}`;
    } catch {
      setDocsError("Нет связи с сервером");
    } finally {
      setCreatingInvoice(false);
    }
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
      body: JSON.stringify({
        items: editItems.map((i) => {
          const qty = Number(i.qty);
          const price = Number(i.price);
          const discount = Number(i.discount);
          const total = Math.round(qty * price * (1 - discount / 100) * 100) / 100;
          return { name: i.name, unit: i.unit, qty, price, discount, total };
        }),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setOrder((prev) => ({ ...prev, items: data.items, amount: data.amount }));
      setEditingItems(false);
    } else {
      alert("Не удалось сохранить позиции. Проверьте, что у каждой позиции заполнены название, кол-во и цена.");
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
  const typeLabels: Record<string, string> = Object.fromEntries(orderTypes.map((t) => [t.code, t.label]));
  const typeOptions = orderTypes
    .filter((t) => t.isActive || t.code === order.type)
    .map((t) => ({ value: t.code, label: t.label }));
  const priorityOptions = Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const paymentOptions = Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }));

  // Одна панель вкладок на два места: на широком экране она стоит в шапке
  // вровень с номером заявки, на узком — над содержимым вкладки.
  const tabBar = (
    <div className="flex overflow-x-auto border-b border-line">
      {(["items", "files", "tasks", "docs", "comments", "history"] as const).map((tab) => {
        const counts: Partial<Record<typeof tab, number>> = {
          files: order.files.length,
          tasks: order.tasks.length,
          docs: docsCount,
          comments: order.comments.length,
        };
        const count = counts[tab] ?? 0;
        return (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "border-accent text-accent"
                : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            {{ items: "Позиции", files: "Файлы", tasks: "Задачи", docs: "Документы", comments: "Комментарии", history: "История" }[tab]}
            {count > 0 && (
              <span className="ml-1.5 rounded bg-surface-hover px-1.5 py-0.5 text-xs text-fg-muted">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Back + Header */}
      <div>
        <Link
          href="/orders"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-fg-subtle transition-colors hover:text-fg"
        >
          <ArrowLeft size={14} /> Все заявки
        </Link>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder="Название заказа"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                />
                <button onClick={saveTitle} disabled={saving} className="p-1.5 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30">
                  <Check size={18} />
                </button>
                <button onClick={() => setEditingTitle(false)} className="p-1.5 rounded text-fg-muted hover:bg-surface-hover">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="truncate text-xl font-semibold tracking-tight text-fg sm:text-[22px]">{order.title || order.number}</h1>
                {canEdit && (
                  <button
                    onClick={() => { setTitleDraft(order.title || ""); setEditingTitle(true); }}
                    className="rounded p-1 text-fg-subtle opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {order.title && <span className="text-xs text-fg-subtle">{order.number}</span>}
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${ORDER_STATUS_COLORS[order.status as keyof typeof ORDER_STATUS_COLORS]}`}>
                {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
              </span>
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${PRIORITY_COLORS[order.priority as keyof typeof PRIORITY_COLORS]}`}>
                {PRIORITY_LABELS[order.priority as keyof typeof PRIORITY_LABELS]}
              </span>
              <span className="text-xs text-fg-subtle">· {formatDate(order.createdAt)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:col-span-2">
            {canEdit && (
              <div className="flex items-center gap-2 lg:justify-end">
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
            <div className="hidden lg:block">{tabBar}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:-mt-2 lg:grid-cols-3">
        {/* Left column - details */}
        <div className="space-y-4">
          {/* Client */}
          <Card padding="md">
            <h2 className="font-semibold text-fg mb-3 flex items-center gap-2">
              <User size={15} /> Клиент
            </h2>
            <Link href={`/clients/${order.client.id}`} className="font-medium text-accent hover:underline text-sm">
              {order.client.name}
            </Link>
            {order.client.phone && (
              <p className="text-xs text-fg-muted mt-1">{order.client.phone}</p>
            )}
          </Card>

          {/* Order info */}
          <Card padding="md">
            <h2 className="font-semibold text-fg mb-3 flex items-center gap-2">
              <AlertCircle size={15} /> Параметры
            </h2>
            <dl className="space-y-2">
              {canEdit ? (
                <>
                  <div>
                    <dt className="text-xs text-fg-muted mb-1">Тип заявки</dt>
                    <Select
                      value={order.type}
                      onChange={(e) => updateField("type", e.target.value)}
                      options={typeOptions}
                    />
                  </div>
                  <div>
                    <dt className="text-xs text-fg-muted mb-1">Приоритет</dt>
                    <Select
                      value={order.priority}
                      onChange={(e) => updateField("priority", e.target.value)}
                      options={priorityOptions}
                    />
                  </div>
                  <div>
                    <dt className="text-xs text-fg-muted mb-1">Срок сдачи</dt>
                    <input
                      type="datetime-local"
                      value={order.deadline ? order.deadline.slice(0, 16) : ""}
                      onChange={(e) => updateField("deadline", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-line rounded-lg focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 bg-surface text-fg"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <dt className="text-fg-muted">Тип</dt>
                    <dd className="text-fg">{typeLabels[order.type] ?? order.type}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-fg-muted">Приоритет</dt>
                    <dd className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${PRIORITY_COLORS[order.priority as keyof typeof PRIORITY_COLORS]}`}>
                      {PRIORITY_LABELS[order.priority as keyof typeof PRIORITY_LABELS]}
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-fg-muted">Срок сдачи</dt>
                    <dd className="text-fg">{formatDate(order.deadline)}</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm">
                <dt className="text-fg-muted">Менеджер</dt>
                <dd className="text-fg">{order.manager?.name || "—"}</dd>
              </div>
            </dl>
          </Card>

          {/* Amount */}
          <Card padding="md">
            <h2 className="font-semibold text-fg mb-3 flex items-center gap-2">
              <CreditCard size={15} /> Оплата
            </h2>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-fg">{formatCurrency(order.amount)}</span>
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${PAYMENT_STATUS_COLORS[order.paymentStatus as keyof typeof PAYMENT_STATUS_COLORS]}`}>
                {PAYMENT_STATUS_LABELS[order.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS]}
              </span>
            </div>
          </Card>

          {/* Assignees */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-fg flex items-center gap-2">
                <User size={15} /> Исполнители
              </h2>
              {canEdit && !addingAssignee && (
                <button onClick={() => setAddingAssignee(true)} className="p-1 rounded hover:bg-surface-hover dark:hover:bg-slate-700 text-fg-subtle hover:text-accent transition-colors">
                  <UserPlus size={15} />
                </button>
              )}
            </div>
            {order.assignees.length === 0 && !addingAssignee && (
              <p className="text-sm text-fg-subtle">Не назначены</p>
            )}
            {order.assignees.length > 0 && (
              <ul className="space-y-1 mb-2">
                {order.assignees.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-accent-soft rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-accent">{a.name.charAt(0)}</span>
                    </div>
                    <span className="text-sm text-fg-muted flex-1">{a.name}</span>
                    {canEdit && (
                      <button onClick={() => removeAssignee(a.id)} className="p-0.5 rounded hover:bg-red-50 text-fg-subtle hover:text-red-500 transition-colors">
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
                  className="flex-1 text-sm border border-line rounded px-2 py-1 bg-surface text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 bg-surface text-fg"
                >
                  <option value="">— выбрать —</option>
                  {users.filter((u) => !order.assignees.some((a) => a.id === u.id)).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button onClick={addAssignee} disabled={!selectedAssigneeId} className="p-1.5 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-40">
                  <Check size={13} />
                </button>
                <button onClick={() => { setAddingAssignee(false); setSelectedAssigneeId(""); }} className="p-1.5 rounded border border-line text-fg-muted hover:bg-surface-sunken dark:hover:bg-slate-700/50 dark:hover:bg-slate-700">
                  <X size={13} />
                </button>
              </div>
            )}
          </Card>

          {order.notes && (
            <Card padding="md">
              <h2 className="font-semibold text-fg mb-2">Примечание</h2>
              <p className="text-sm text-fg-muted whitespace-pre-line">{order.notes}</p>
            </Card>
          )}
        </div>

        {/* Right column - tabs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="lg:hidden">{tabBar}</div>

          {/* Items tab */}
          {activeTab === "items" && (
            <Card padding="none">
              {canEdit && (
                <div className="flex justify-end px-4 py-2 border-b border-line-soft">
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
                <div className="py-10 text-center text-fg-subtle text-sm">Позиций нет</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line-soft bg-surface-sunken">
                      <th className="text-left px-5 py-3 text-xs font-medium text-fg-muted uppercase">Наименование</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-fg-muted uppercase">Кол-во</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-fg-muted uppercase">Цена</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-fg-muted uppercase">Скидка%</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-fg-muted uppercase">Итого</th>
                      {editingItems && <th className="px-2 py-3 w-8"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {editingItems ? (
                      <>
                        {editItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">
                              <input
                                value={item.name}
                                onChange={(e) => updateEditItem(idx, "name", e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-line rounded focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 bg-surface text-fg"
                                placeholder="Наименование"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex gap-1 items-center">
                                <input
                                  type="number" min="0.01" step="any" value={item.qty}
                                  onChange={(e) => updateEditItem(idx, "qty", parseFloat(e.target.value) || 0)}
                                  className="w-16 px-2 py-1 text-sm border border-line rounded text-right focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 bg-surface text-fg"
                                />
                                <input
                                  value={item.unit}
                                  onChange={(e) => updateEditItem(idx, "unit", e.target.value)}
                                  className="w-12 px-2 py-1 text-sm border border-line rounded focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 bg-surface text-fg"
                                />
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number" min="0" step="any" value={item.price}
                                onChange={(e) => updateEditItem(idx, "price", parseFloat(e.target.value) || 0)}
                                className="w-28 px-2 py-1 text-sm border border-line rounded text-right focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 bg-surface text-fg"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number" min="0" max="100" step="any" value={item.discount}
                                onChange={(e) => updateEditItem(idx, "discount", parseFloat(e.target.value) || 0)}
                                className="w-16 px-2 py-1 text-sm border border-line rounded text-right focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 bg-surface text-fg"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-fg-muted">
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
                            <button onClick={addEditItem} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover font-medium">
                              <Plus size={13} /> Добавить позицию
                            </button>
                          </td>
                        </tr>
                        <tr className="bg-surface-sunken border-t border-line">
                          <td colSpan={4} className="px-5 py-3 text-right font-semibold text-fg-muted">Итого:</td>
                          <td className="px-5 py-3 text-right font-bold text-fg text-base">{formatCurrency(editTotal)}</td>
                          <td></td>
                        </tr>
                      </>
                    ) : (
                      <>
                        {order.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-5 py-3 font-medium text-fg">{item.name}</td>
                            <td className="px-4 py-3 text-right text-fg-muted">{item.qty} {item.unit}</td>
                            <td className="px-4 py-3 text-right text-fg-muted">{formatCurrency(item.price)}</td>
                            <td className="px-4 py-3 text-right text-fg-muted">{item.discount}%</td>
                            <td className="px-5 py-3 text-right font-semibold text-fg">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                        <tr className="bg-surface-sunken border-t border-line">
                          <td colSpan={4} className="px-5 py-3 text-right font-semibold text-fg-muted">Итого:</td>
                          <td className="px-5 py-3 text-right font-bold text-fg text-base">{formatCurrency(order.amount)}</td>
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
                    <Upload size={28} className="mx-auto mb-1 text-accent" />
                    <p className="text-sm font-medium text-accent">Отпустите для загрузки</p>
                    <p className="text-xs text-accent">Изображения → скрин-превью, остальное → файлы</p>
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
                    <p className="text-xs font-medium text-fg-muted uppercase mb-2">Скрин-превью</p>
                    <div className="grid grid-cols-2 gap-2">
                      {screenshots.map((of) => {
                        const previewUrl = localPreviewsRef.current.get(of.id) || of.file.downloadUrl;
                        return (
                          <div key={of.id} className="relative group rounded-lg overflow-hidden border border-line-soft bg-surface-sunken">
                            {previewUrl ? (
                              <img src={previewUrl} alt={of.file.originalName} className="w-full object-contain max-h-48" />
                            ) : (
                              <div className="h-32 flex items-center justify-center text-fg-subtle">
                                <ImageIcon size={32} />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/40 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-xs text-white truncate">{of.file.originalName}</span>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {of.file.downloadUrl && (
                                  <a href={of.file.downloadUrl} target="_blank" rel="noreferrer"
                                    className="p-0.5 rounded bg-surface/20 hover:bg-surface/40 text-white">
                                    <Download size={12} />
                                  </a>
                                )}
                                {canEdit && (
                                  <button onClick={() => handleDeleteFile(of.id)}
                                    className="p-0.5 rounded bg-surface/20 hover:bg-red-500/80 text-white">
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
                      <div className="py-10 text-center text-fg-subtle text-sm">
                        <Paperclip size={28} className="mx-auto mb-2 opacity-30" />
                        <p>Файлов нет</p>
                        {canEdit && <p className="text-xs mt-1 text-fg-subtle">Перетащите сюда или нажмите Ctrl+V для скриншота</p>}
                      </div>
                    ) : regularFiles.length === 0 ? (
                      <div className="py-6 text-center text-fg-subtle text-sm">
                        <p className="text-xs text-fg-subtle">Файлов нет — только скрины выше</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-line-soft">
                        {regularFiles.map((of) => (
                          <div key={of.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-sunken dark:hover:bg-slate-700/50 transition-colors">
                            <FileText size={18} className="shrink-0 text-fg-subtle" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-fg truncate">{of.file.originalName}</p>
                              <p className="text-xs text-fg-subtle">
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
                  <div className="py-10 text-center text-fg-subtle text-sm">
                    <CheckSquare size={28} className="mx-auto mb-2 opacity-30" />
                    Задач нет
                  </div>
                ) : (
                  <div className="divide-y divide-line-soft">
                    {order.tasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/tasks/${task.id}`}
                        className="flex items-center justify-between px-5 py-3 hover:bg-surface-sunken dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-fg text-sm">{task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-fg-subtle">{TASK_TYPE_LABELS[task.type as keyof typeof TASK_TYPE_LABELS]}</span>
                            {task.assignee && (
                              <span className="text-xs text-fg-subtle">· {task.assignee.name}</span>
                            )}
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-fg-muted ring-1 ring-inset ring-line">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: taskStatusColors[task.status] ?? "#64748b" }}
                          />
                          {taskStatusLabels[task.status] ?? task.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Comments tab */}
          {/* Documents tab */}
          {activeTab === "docs" && (
            <div className="space-y-4">
              {docsError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
                  {docsError}
                </div>
              )}

              {canEdit && (
                <Card padding="md">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg">Счёт по этой заявке</p>
                      <p className="mt-0.5 text-xs text-fg-muted">
                        Позиции и клиент подставятся из заявки, счёт останется привязан к ней
                      </p>
                    </div>
                    <Button onClick={createInvoiceFromOrder} loading={creatingInvoice}>
                      <Plus size={16} /> Сформировать счёт
                    </Button>
                  </div>
                </Card>
              )}

              <DocumentList
                title="Счета"
                icon={<FileText size={15} />}
                href="/invoices"
                items={order.invoices.map((i) => ({
                  id: i.id,
                  number: i.number,
                  date: i.date,
                  total: i.total,
                  badge: i.isPaid ? "Оплачен" : null,
                }))}
                empty="Счетов по заявке пока нет"
              />

              <DocumentList
                title="Акты"
                icon={<ClipboardList size={15} />}
                href="/acts"
                items={order.acts}
                empty="Актов пока нет"
              />

              <DocumentList
                title="Накладные"
                icon={<FileSpreadsheet size={15} />}
                href="/waybills"
                items={order.waybills}
                empty="Накладных пока нет"
              />
            </div>
          )}

          {activeTab === "comments" && (
            <div className="space-y-3">
              <Card padding="none">
                <div className="divide-y divide-line-soft">
                  {order.comments.length === 0 ? (
                    <div className="py-8 text-center text-fg-subtle text-sm">Комментариев нет</div>
                  ) : (
                    order.comments.map((c) => (
                      <div key={c.id} className={`px-5 py-3 ${c.user.id === currentUserId ? "bg-accent-soft" : ""}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-fg">{c.user.name}</span>
                          <span className="text-xs text-fg-subtle">{formatDateTime(c.createdAt)}</span>
                        </div>
                        <p className="text-sm text-fg-muted whitespace-pre-line">{c.text}</p>
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
                  className="flex-1 px-4 py-2 text-sm border border-line rounded-lg focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 bg-surface text-fg"
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
                <div className="py-8 text-center text-fg-subtle text-sm">Изменений нет</div>
              ) : (
                <div className="divide-y divide-line-soft">
                  {order.changeLogs.map((log) => (
                    <div key={log.id} className="px-5 py-3">
                      <div className="flex items-center gap-2 text-xs text-fg-muted mb-0.5">
                        <Clock size={11} />
                        <span>{formatDateTime(log.createdAt)}</span>
                        <span>·</span>
                        <span className="font-medium text-fg-muted">{log.user.name}</span>
                      </div>
                      <p className="text-sm text-fg-muted">
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
