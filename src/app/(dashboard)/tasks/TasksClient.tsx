"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import {
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "@/lib/constants";
import { useTaskColumns } from "@/hooks/useTaskColumns";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Plus, Search, CheckSquare, CheckCircle2, Circle } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  tags: string[];
  assignee: { id: string; name: string } | null;
  order: { id: string; number: string; client: { name: string } } | null;
  checklistItems: { id: string; isCompleted: boolean }[];
}

interface Props {
  initialTasks: Task[];
  users: { id: string; name: string; role: string }[];
  orders: { id: string; number: string; client: { name: string } }[];
  currentUserId: string;
  currentRole: string;
}

export default function TasksClient({ initialTasks, users, orders, currentUserId, currentRole }: Props) {
  const { visible: boardColumns, labels: statusLabels, colors: statusColors } = useTaskColumns();
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [tasks, setTasks] = useState(initialTasks);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "",
    type: "DESIGN",
    priority: "NORMAL",
    assigneeId: "",
    orderId: "",
    dueDate: "",
    description: "",
  });

  useEffect(() => {
    fetch("/api/tags").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setAvailableTags(data);
    });
  }, []);

  const filtered = tasks.filter((t) => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || t.type === typeFilter;
    return matchSearch && matchType;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tags: selectedTags,
        assigneeId: form.assigneeId || undefined,
        orderId: form.orderId || undefined,
        dueDate: form.dueDate || undefined,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setTasks((prev) => [{ ...created, createdAt: created.createdAt, checklistItems: [] }, ...prev]);
      setModalOpen(false);
      setForm({ title: "", type: "DESIGN", priority: "NORMAL", assigneeId: "", orderId: "", dueDate: "", description: "" });
      setSelectedTags([]);
    }
    setLoading(false);
  }

  function toggleTag(tagName: string) {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  }

  async function updateTaskStatus(taskId: string, newStatus: string) {
    const previous = tasks.find((t) => t.id === taskId)?.status;
    if (previous === newStatus) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok && previous !== undefined) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: previous } : t)),
      );
    }
  }

  function handleDrop(status: string) {
    setDropTarget(null);
    const id = dragTaskId;
    setDragTaskId(null);
    if (id) updateTaskStatus(id, status);
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <PageHeader
        icon={<CheckSquare size={18} />}
        title="Задачи"
        subtitle={`${tasks.length} задач(и)`}
        actions={
          <>
            <div className="flex rounded-lg border border-line bg-surface p-0.5">
              <button
                onClick={() => setViewMode("board")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "board" ? "bg-accent-soft text-accent-fg" : "text-fg-muted hover:text-fg"}`}
              >
                Kanban
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-accent-soft text-accent-fg" : "text-fg-muted hover:text-fg"}`}
              >
                Список
              </button>
            </div>
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Новая задача
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            type="text"
            placeholder="Поиск задач..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-line rounded-lg bg-surface text-fg placeholder:text-fg-subtle dark:placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-line rounded-lg focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 bg-surface text-fg"
        >
          <option value="">Все типы</option>
          {Object.entries(TASK_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Kanban Board */}
      {viewMode === "board" && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {boardColumns.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.code);
            return (
              <div
                key={col.code}
                className="flex w-72 shrink-0 flex-col gap-3"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropTarget(col.code);
                }}
                onDragLeave={() => setDropTarget((prev) => (prev === col.code ? null : prev))}
                onDrop={() => handleDrop(col.code)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: col.color ?? "#64748b" }}
                    />
                    {col.name}
                  </h3>
                  <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-fg-muted">
                    {colTasks.length}
                  </span>
                </div>
                <div
                  className={`min-h-20 space-y-2 rounded-lg transition-colors ${
                    dropTarget === col.code ? "bg-accent-soft/60 ring-1 ring-inset ring-accent/25" : ""
                  }`}
                >
                  {colTasks.map((task) => {
                    const done = task.checklistItems.filter((c) => c.isCompleted).length;
                    const total = task.checklistItems.length;
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => setDragTaskId(task.id)}
                        onDragEnd={() => {
                          setDragTaskId(null);
                          setDropTarget(null);
                        }}
                        className={`cursor-grab rounded-lg border border-line bg-surface p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${
                          dragTaskId === task.id ? "opacity-50" : ""
                        }`}
                      >
                        <Link href={`/tasks/${task.id}`} className="block">
                          <p className="text-sm font-medium text-fg mb-1.5 line-clamp-2">
                            {task.title}
                          </p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]}`}>
                              {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 bg-surface-hover text-fg-muted rounded">
                              {TASK_TYPE_LABELS[task.type as keyof typeof TASK_TYPE_LABELS]}
                            </span>
                          </div>
                          {task.order && (
                            <p className="text-xs text-accent mb-1 truncate">
                              {task.order.number}{task.order.client ? ` · ${task.order.client.name}` : ''}
                            </p>
                          )}
                          {task.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {task.tags.map((tag) => {
                                const tagObj = availableTags.find((t) => t.name === tag);
                                return (
                                  <span
                                    key={tag}
                                    className="text-xs px-1.5 py-0.5 rounded-full font-medium text-white"
                                    style={{ backgroundColor: tagObj?.color || "#6366f1" }}
                                  >
                                    {tag}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {total > 0 && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="flex-1 h-1 bg-surface-hover rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 rounded-full"
                                  style={{ width: `${(done / total) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-fg-subtle">{done}/{total}</span>
                            </div>
                          )}
                          {task.assignee && (
                            <p className="text-xs text-fg-subtle truncate">{task.assignee.name}</p>
                          )}
                        </Link>
                        <div className="mt-2 border-t border-line-soft pt-2">
                          <select
                            value={task.status}
                            onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                            className="w-full rounded border border-line bg-surface px-2 py-1 text-xs text-fg focus:outline-none"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {boardColumns.map((c) => (
                              <option key={c.code} value={c.code}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-line">
                      <span className="text-xs text-fg-subtle">
                        {dragTaskId ? "Перенести сюда" : "Пусто"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <Card padding="none">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-soft bg-surface-sunken">
                <th className="text-left px-5 py-3 text-xs font-medium text-fg-muted uppercase">Задача</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-fg-muted uppercase">Тип</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-fg-muted uppercase">Статус</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-fg-muted uppercase">Приоритет</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-fg-muted uppercase">Срок</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-fg-muted uppercase">Исполнитель</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-fg-subtle">Задач нет</td>
                </tr>
              ) : (
                filtered.map((task) => (
                  <tr key={task.id} className="hover:bg-surface-sunken dark:hover:bg-slate-700/50">
                    <td className="px-5 py-3">
                      <Link href={`/tasks/${task.id}`} className="group">
                        <p className="font-medium text-fg group-hover:text-accent">{task.title}</p>
                        {task.order && (
                          <p className="text-xs text-fg-subtle">{task.order.number} · {task.order.client.name}</p>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted">
                      {TASK_TYPE_LABELS[task.type as keyof typeof TASK_TYPE_LABELS]}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-fg-muted ring-1 ring-inset ring-line">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: statusColors[task.status] ?? "#64748b" }}
                        />
                        {statusLabels[task.status] ?? task.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]}`}>
                        {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted">{formatDate(task.dueDate)}</td>
                    <td className="px-5 py-3 text-xs text-fg-muted">{task.assignee?.name || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      {/* Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Новая задача" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Название *"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Что нужно сделать?"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Тип задачи"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={Object.entries(TASK_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
            <Select
              label="Приоритет"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
          </div>
          <Select
            label="Исполнитель"
            value={form.assigneeId}
            onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
            placeholder="Выберите исполнителя"
            options={users.map((u) => ({ value: u.id, label: u.name }))}
          />
          <Select
            label="Привязать к заявке"
            value={form.orderId}
            onChange={(e) => setForm({ ...form, orderId: e.target.value })}
            placeholder="Выберите заявку (необязательно)"
            options={orders.map((o) => ({ value: o.id, label: `${o.number} · ${o.client.name}` }))}
          />
          <Input
            label="Срок выполнения"
            type="datetime-local"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
          <div>
            <label className="text-sm font-medium text-fg-muted block mb-1">Описание</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-surface text-fg placeholder:text-fg-subtle dark:placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
              placeholder="Описание задачи..."
            />
          </div>
          {availableTags.length > 0 && (
            <div>
              <label className="text-sm font-medium text-fg-muted block mb-2">Теги</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.name);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.name)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border-2 transition-all dark:border-slate-600 ${
                        isSelected ? "text-white border-transparent" : "bg-surface border-line text-fg-muted hover:border-gray-300"
                      }`}
                      style={isSelected ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button type="submit" loading={loading}>Создать задачу</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
