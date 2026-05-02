"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "@/lib/constants";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { ArrowLeft, CheckCircle2, Circle, Plus, Send, Paperclip, Download, FileText, Image as ImageIcon, Upload } from "lucide-react";

interface TaskFile {
  id: string;
  createdAt: string;
  file: {
    id: string;
    key: string;
    originalName: string;
    size: number;
    mimeType: string;
    uploadedBy: { id: string; name: string };
  };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  dueDate: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  tags: string[];
  assignee: { id: string; name: string } | null;
  order: { id: string; number: string; client: { name: string } } | null;
  checklistItems: { id: string; text: string; isCompleted: boolean; sortOrder: number }[];
  comments: { id: string; text: string; createdAt: string; user: { id: string; name: string } }[];
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [taskFiles, setTaskFiles] = useState<TaskFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [checklistText, setChecklistText] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [activeTab, setActiveTab] = useState<"checklist" | "files" | "comments">("checklist");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/tasks/${params.id}`).then((r) => r.json()),
      fetch(`/api/tasks/${params.id}/files`).then((r) => r.json()),
    ]).then(([taskData, filesData]) => {
      setTask(taskData);
      setTaskFiles(Array.isArray(filesData) ? filesData : []);
    }).finally(() => setLoading(false));
  }, [params.id]);

  async function updateTask(data: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/tasks/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setTask((prev) => prev ? { ...prev, ...updated } : null);
    }
    setSaving(false);
  }

  async function toggleChecklist(itemId: string, isCompleted: boolean) {
    const res = await fetch(`/api/tasks/${params.id}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, isCompleted }),
    });
    if (res.ok && task) {
      setTask({
        ...task,
        checklistItems: task.checklistItems.map((i) =>
          i.id === itemId ? { ...i, isCompleted } : i
        ),
      });
    }
  }

  async function addChecklistItem(e: React.FormEvent) {
    e.preventDefault();
    if (!checklistText.trim()) return;
    const res = await fetch(`/api/tasks/${params.id}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: checklistText.trim() }),
    });
    if (res.ok && task) {
      const item = await res.json();
      setTask({ ...task, checklistItems: [...task.checklistItems, item] });
      setChecklistText("");
    }
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || !task) return;
    const res = await fetch(`/api/tasks/${params.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: commentText.trim() }),
    });
    if (res.ok) {
      const comment = await res.json();
      setTask({ ...task, comments: [...task.comments, comment] });
      setCommentText("");
    }
  }

  async function handleFileUpload(file: File) {
    setUploadingFile(true);
    try {
      const res = await fetch(`/api/tasks/${params.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          category: "SOURCES",
        }),
      });
      if (!res.ok) return;
      const { taskFile, uploadUrl } = await res.json();
      if (uploadUrl) {
        await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      }
      setTaskFiles((prev) => [taskFile, ...prev]);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteFile(taskFileId: string) {
    if (!confirm("Удалить файл?")) return;
    const res = await fetch(`/api/tasks/${params.id}/files?taskFileId=${taskFileId}`, { method: "DELETE" });
    if (res.ok) setTaskFiles((prev) => prev.filter((f) => f.id !== taskFileId));
  }

  if (loading) return <div className="p-6 text-center text-gray-400 dark:text-slate-500">Загрузка...</div>;
  if (!task) return <div className="p-6 text-center text-gray-400 dark:text-slate-500">Задача не найдена</div>;

  const doneItems = task.checklistItems.filter((i) => i.isCompleted).length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <Link href="/tasks" className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:text-slate-300 mb-3">
          <ArrowLeft size={14} /> Все задачи
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{task.title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TASK_STATUS_COLORS[task.status as keyof typeof TASK_STATUS_COLORS]}`}>
                {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]}`}>
                {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
              </span>
              <span className="text-xs text-gray-400 dark:text-slate-500">{TASK_TYPE_LABELS[task.type as keyof typeof TASK_TYPE_LABELS]}</span>
              {task.tags?.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <Select
            value={task.status}
            onChange={(e) => updateTask({ status: e.target.value })}
            options={Object.entries(TASK_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="space-y-4">
          <Card padding="md">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-slate-500">Создана</dt>
                <dd className="text-gray-800 dark:text-slate-200">{formatDate(task.createdAt)}</dd>
              </div>
              {task.dueDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-slate-500">Срок</dt>
                  <dd className="text-gray-800 dark:text-slate-200">{formatDate(task.dueDate)}</dd>
                </div>
              )}
              {task.startedAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-slate-500">Начата</dt>
                  <dd className="text-gray-800 dark:text-slate-200">{formatDateTime(task.startedAt)}</dd>
                </div>
              )}
              {task.finishedAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-slate-500">Завершена</dt>
                  <dd className="text-gray-800 dark:text-slate-200">{formatDateTime(task.finishedAt)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-slate-500">Исполнитель</dt>
                <dd className="text-gray-800 dark:text-slate-200">{task.assignee?.name || "—"}</dd>
              </div>
              {task.order && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-slate-500">Заявка</dt>
                  <dd>
                    <Link href={`/orders/${task.order.id}`} className="text-violet-600 hover:underline text-xs">
                      {task.order.number}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {task.description && (
            <Card padding="md">
              <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-2">Описание</h2>
              <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-line">{task.description}</p>
            </Card>
          )}
        </div>

        {/* Right */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-slate-700">
            {(["checklist", "files", "comments"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-violet-600 text-violet-600"
                    : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300 dark:hover:text-slate-200"
                }`}
              >
                {{ checklist: "Чеклист", files: "Файлы", comments: "Комментарии" }[tab]}
                {tab === "files" && taskFiles.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded text-xs">{taskFiles.length}</span>
                )}
                {tab === "comments" && task.comments.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded text-xs">{task.comments.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Checklist tab */}
          {activeTab === "checklist" && (
            <Card padding="md">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-800 dark:text-slate-200">
                  Чеклист
                  {task.checklistItems.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-400 dark:text-slate-500">
                      {doneItems}/{task.checklistItems.length}
                    </span>
                  )}
                </h2>
              </div>
              {task.checklistItems.length > 0 && (
                <div className="mb-3">
                  <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${(doneItems / task.checklistItems.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <ul className="space-y-2 mb-3">
                {task.checklistItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <button
                      onClick={() => toggleChecklist(item.id, !item.isCompleted)}
                      className="shrink-0 text-gray-400 dark:text-slate-500 hover:text-green-600 transition-colors"
                    >
                      {item.isCompleted ? (
                        <CheckCircle2 size={18} className="text-green-600" />
                      ) : (
                        <Circle size={18} />
                      )}
                    </button>
                    <span className={`text-sm ${item.isCompleted ? "line-through text-gray-400 dark:text-slate-500" : "text-gray-700 dark:text-slate-300"}`}>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
              <form onSubmit={addChecklistItem} className="flex gap-2">
                <input
                  type="text"
                  value={checklistText}
                  onChange={(e) => setChecklistText(e.target.value)}
                  placeholder="Добавить пункт..."
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:text-slate-500 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                />
                <Button type="submit" size="sm" disabled={!checklistText.trim()}>
                  <Plus size={14} />
                </Button>
              </form>
            </Card>
          )}

          {/* Files tab */}
          {activeTab === "files" && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                />
                <Button
                  type="button"
                  variant="outline"
                  loading={uploadingFile}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} /> Загрузить файл
                </Button>
              </div>
              <Card padding="none">
                {taskFiles.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                    <Paperclip size={28} className="mx-auto mb-2 opacity-30" />
                    Файлов нет
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-slate-700">
                    {taskFiles.map((tf) => {
                      const isImage = tf.file.mimeType.startsWith("image/");
                      return (
                        <div key={tf.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                          <div className="shrink-0 text-gray-400 dark:text-slate-500">
                            {isImage ? <ImageIcon size={18} /> : <FileText size={18} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{tf.file.originalName}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">
                              {formatFileSize(tf.file.size)} · {tf.file.uploadedBy.name} · {formatDate(tf.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <a href={`/api/files/view?key=${encodeURIComponent(tf.file.key)}`} target="_blank" rel="noreferrer">
                              <Button type="button" variant="outline" size="sm">
                                <Download size={13} />
                              </Button>
                            </a>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteFile(tf.id)}
                            >
                              <span className="text-red-500 text-xs">✕</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Comments tab */}
          {activeTab === "comments" && (
            <Card padding="none">
              <div className="divide-y divide-gray-50 dark:divide-slate-700">
                {task.comments.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-400 dark:text-slate-500">Комментариев нет</div>
                ) : (
                  task.comments.map((c) => (
                    <div key={c.id} className="px-5 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{c.user.name}</span>
                        <span className="text-xs text-gray-400 dark:text-slate-500">{formatDateTime(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-slate-300">{c.text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-700">
                <form onSubmit={sendComment} className="flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Написать комментарий..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                  />
                  <Button type="submit" disabled={!commentText.trim()}>
                    <Send size={14} />
                  </Button>
                </form>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
