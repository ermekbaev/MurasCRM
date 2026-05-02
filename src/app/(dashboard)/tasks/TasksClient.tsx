"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "@/lib/constants";
import Card from "@/components/ui/Card";
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

const STATUS_COLUMNS = [
  { key: "TODO", label: "К выполнению" },
  { key: "IN_PROGRESS", label: "В работе" },
  { key: "REVIEW", label: "На проверке" },
  { key: "DONE", label: "Готово" },
] as const;

export default function TasksClient({ initialTasks, users, orders, currentUserId, currentRole }: Props) {
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
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Задачи</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{tasks.length} задач(и)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("board")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "board" ? "bg-violet-600 text-white" : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700"}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-violet-600 text-white" : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700"}`}
            >
              Список
            </button>
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Новая задача
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Поиск задач..."
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
          {Object.entries(TASK_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Kanban Board */}
      {viewMode === "board" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.key);
            return (
              <div key={col.key} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">{col.label}</h3>
                  <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded-full px-2 py-0.5">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2 min-h-20">
                  {colTasks.map((task) => {
                    const done = task.checklistItems.filter((c) => c.isCompleted).length;
                    const total = task.checklistItems.length;
                    return (
                      <div
                        key={task.id}
                        className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <Link href={`/tasks/${task.id}`} className="block">
                          <p className="text-sm font-medium text-gray-800 dark:text-slate-200 mb-1.5 line-clamp-2">
                            {task.title}
                          </p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]}`}>
                              {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded">
                              {TASK_TYPE_LABELS[task.type as keyof typeof TASK_TYPE_LABELS]}
                            </span>
                          </div>
                          {task.order && (
                            <p className="text-xs text-violet-600 mb-1 truncate">
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
                              <div className="flex-1 h-1 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 rounded-full"
                                  style={{ width: `${(done / total) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 dark:text-slate-500">{done}/{total}</span>
                            </div>
                          )}
                          {task.assignee && (
                            <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{task.assignee.name}</p>
                          )}
                        </Link>
                        {col.key !== "DONE" && (
                          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                            <select
                              value={task.status}
                              onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                              className="w-full text-xs border border-gray-200 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {Object.entries(TASK_STATUS_LABELS).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <div className="border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg h-20 flex items-center justify-center">
                      <span className="text-xs text-gray-400 dark:text-slate-500">Пусто</span>
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
              <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Задача</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Тип</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Статус</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Приоритет</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Срок</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Исполнитель</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400 dark:text-slate-500">Задач нет</td>
                </tr>
              ) : (
                filtered.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700/50">
                    <td className="px-5 py-3">
                      <Link href={`/tasks/${task.id}`} className="group">
                        <p className="font-medium text-gray-800 dark:text-slate-200 group-hover:text-violet-600">{task.title}</p>
                        {task.order && (
                          <p className="text-xs text-gray-400 dark:text-slate-500">{task.order.number} · {task.order.client.name}</p>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400">
                      {TASK_TYPE_LABELS[task.type as keyof typeof TASK_TYPE_LABELS]}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TASK_STATUS_COLORS[task.status as keyof typeof TASK_STATUS_COLORS]}`}>
                        {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]}`}>
                        {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400">{formatDate(task.dueDate)}</td>
                    <td className="px-5 py-3 text-xs text-gray-600 dark:text-slate-400">{task.assignee?.name || "—"}</td>
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
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 block mb-1">Описание</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:text-slate-500 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Описание задачи..."
            />
          </div>
          {availableTags.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300 block mb-2">Теги</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.name);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.name)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border-2 transition-all dark:border-slate-600 ${
                        isSelected ? "text-white border-transparent" : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-gray-300"
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
