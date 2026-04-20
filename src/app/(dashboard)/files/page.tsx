"use client";

import { useState, useEffect, useRef } from "react";
import { formatDate, formatFileSize } from "@/lib/utils";
import { FILE_CATEGORY_LABELS, FILE_STATUS_LABELS, ALLOWED_FILE_TYPES } from "@/lib/constants";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import {
  FolderOpen, Upload, Download, Search, File, Image, FileText, AlertCircle,
  Eye, X, Trash2, CheckCircle2, RotateCcw, GitBranch, MessageSquare, Send,
} from "lucide-react";

interface FileComment {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; name: string };
}

interface FileRecord {
  id: string;
  key: string;
  originalName: string;
  size: number;
  mimeType: string;
  category: string;
  status: string;
  version: number;
  createdAt: string;
  uploadedBy: { id: string; name: string };
  linkedTo: string | null;
  linkedId: string | null;
  comment: string | null;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  SOURCES: <FolderOpen size={14} className="text-blue-500" />,
  PENDING_APPROVAL: <AlertCircle size={14} className="text-yellow-500" />,
  APPROVED: <Eye size={14} className="text-green-500" />,
  READY: <File size={14} className="text-violet-500" />,
  ARCHIVE: <FolderOpen size={14} className="text-gray-400" />,
};

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image size={16} className="text-blue-500" />;
  if (mimeType === "application/pdf") return <FileText size={16} className="text-red-500" />;
  return <File size={16} className="text-gray-500" />;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "pdf" | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [replacingFileId, setReplacingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);

  // Upload linking
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLinkedTo, setUploadLinkedTo] = useState("");
  const [uploadLinkedId, setUploadLinkedId] = useState("");
  const [uploadOrders, setUploadOrders] = useState<{ id: string; number: string }[]>([]);
  const [uploadTasks, setUploadTasks] = useState<{ id: string; title: string }[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/orders?limit=50").then((r) => r.json()),
      fetch("/api/tasks?limit=50").then((r) => r.json()),
    ]).then(([ordersData, tasksData]) => {
      setUploadOrders(Array.isArray(ordersData.orders) ? ordersData.orders : Array.isArray(ordersData) ? ordersData : []);
      setUploadTasks(Array.isArray(tasksData.tasks) ? tasksData.tasks : Array.isArray(tasksData) ? tasksData : []);
    });
  }, []);

  function openUploadModal(file: File) {
    setUploadFile(file);
    setUploadLinkedTo("");
    setUploadLinkedId("");
    setUploadModalOpen(true);
  }

  async function confirmUpload() {
    if (!uploadFile) return;
    setUploadLoading(true);
    try {
      const metaRes = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalName: uploadFile.name,
          mimeType: uploadFile.type || "application/octet-stream",
          size: uploadFile.size,
          category: categoryFilter || "SOURCES",
          linkedTo: uploadLinkedTo || undefined,
          linkedId: uploadLinkedId || undefined,
        }),
      });
      const { file: fileRecord, uploadUrl } = await metaRes.json();
      if (uploadUrl) {
        await fetch(uploadUrl, { method: "PUT", body: uploadFile, headers: { "Content-Type": uploadFile.type || "application/octet-stream" } });
      }
      setFiles((prev) => [{ ...fileRecord, uploadedBy: { id: "", name: "Вы" }, createdAt: new Date().toISOString() }, ...prev]);
      setUploadModalOpen(false);
      setUploadFile(null);
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Comments panel
  const [commentFile, setCommentFile] = useState<FileRecord | null>(null);
  const [comments, setComments] = useState<FileComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  async function openComments(file: FileRecord) {
    setCommentFile(file);
    setCommentsLoading(true);
    const res = await fetch(`/api/files/${file.id}/comments`);
    const data = await res.json();
    setComments(Array.isArray(data) ? data : []);
    setCommentsLoading(false);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentFile || !newComment.trim()) return;
    setSendingComment(true);
    const res = await fetch(`/api/files/${commentFile.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newComment.trim() }),
    });
    if (res.ok) {
      const comment = await res.json();
      setComments((prev) => [...prev, comment]);
      setNewComment("");
    }
    setSendingComment(false);
  }

  useEffect(() => {
    fetch("/api/files")
      .then((r) => r.json())
      .then((data) => { setFiles(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  const filtered = files.filter((f) => {
    const matchSearch = !search || f.originalName.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || f.category === categoryFilter;
    return matchSearch && matchCat;
  });

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    openUploadModal(file);
  }

  async function handleVersionUpload(replaceId: string, file: File) {
    setUploading(true);
    try {
      const metaRes = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          category: categoryFilter || "SOURCES",
          replaceId,
        }),
      });
      const { file: fileRecord, uploadUrl } = await metaRes.json();
      if (uploadUrl) {
        await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      }
      setFiles((prev) => [{ ...fileRecord, uploadedBy: { id: "", name: "Вы" }, createdAt: new Date().toISOString() }, ...prev]);
    } finally {
      setUploading(false);
      setReplacingFileId(null);
      if (versionInputRef.current) versionInputRef.current.value = "";
    }
  }

  async function changeCategory(fileId: string, category: string) {
    const res = await fetch(`/api/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    if (res.ok) {
      setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, category } : f));
    }
  }

  async function handleDelete(fileId: string, name: string) {
    if (!confirm(`Удалить файл «${name}»?`)) return;
    const res = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
    if (res.ok) setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  async function downloadFile(file: FileRecord) {
    const res = await fetch(`/api/files/${file.id}/download`);
    if (res.ok) {
      const { url } = await res.json();
      window.open(url, "_blank");
    }
  }

  async function previewFile(file: FileRecord) {
    const res = await fetch(`/api/files/${file.id}/download`);
    if (!res.ok) return;
    const { url } = await res.json();
    setPreviewName(file.originalName);
    if (file.mimeType.startsWith("image/")) {
      setPreviewType("image");
    } else if (file.mimeType === "application/pdf") {
      setPreviewType("pdf");
    }
    setPreviewUrl(url);
  }

  function canPreview(mimeType: string) {
    return mimeType.startsWith("image/") || mimeType === "application/pdf";
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderOpen size={24} className="text-violet-600" />
            Файловый хаб
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{files.length} файлов</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_FILE_TYPES.join(",")}
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={versionInputRef}
            type="file"
            accept={ALLOWED_FILE_TYPES.join(",")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && replacingFileId) handleVersionUpload(replacingFileId, f);
            }}
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()} loading={uploading}>
            <Upload size={16} /> Загрузить файл
          </Button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter("")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !categoryFilter ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Все ({files.length})
        </button>
        {Object.entries(FILE_CATEGORY_LABELS).map(([key, label]) => {
          const count = files.filter((f) => f.category === key).length;
          return (
            <button
              key={key}
              onClick={() => setCategoryFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === key ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {CATEGORY_ICONS[key]}
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <Card padding="sm">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск файлов..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </Card>

      {/* Files grid / table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <Card padding="md" className="text-center py-12">
          <FolderOpen size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm">Файлов нет</p>
          <p className="text-xs text-gray-300 mt-1">
            Поддерживаемые форматы: {ALLOWED_FILE_TYPES.join(", ")}
          </p>
        </Card>
      ) : (
        <Card padding="none">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Файл</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Категория</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Размер</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Загрузил</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {getFileIcon(file.mimeType)}
                      <div>
                        <p className="font-medium text-gray-800 text-sm truncate max-w-48">
                          {file.originalName}
                        </p>
                        {file.version > 1 && (
                          <span className="text-xs text-violet-500">v{file.version}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs text-gray-600">
                      {CATEGORY_ICONS[file.category]}
                      {FILE_CATEGORY_LABELS[file.category as keyof typeof FILE_CATEGORY_LABELS]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {FILE_STATUS_LABELS[file.status as keyof typeof FILE_STATUS_LABELS]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {file.uploadedBy.name}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatDate(file.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      {canPreview(file.mimeType) && (
                        <button
                          onClick={() => previewFile(file)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                          title="Просмотр"
                        >
                          <Eye size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => downloadFile(file)}
                        className="p-1.5 rounded hover:bg-violet-50 text-violet-500 transition-colors"
                        title="Скачать"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => { setReplacingFileId(file.id); setTimeout(() => versionInputRef.current?.click(), 50); }}
                        className="p-1.5 rounded hover:bg-indigo-50 text-indigo-400 transition-colors"
                        title="Загрузить новую версию"
                      >
                        <GitBranch size={14} />
                      </button>
                      {file.category !== "APPROVED" && (
                        <button
                          onClick={() => changeCategory(file.id, "APPROVED")}
                          className="p-1.5 rounded hover:bg-green-50 text-green-500 transition-colors"
                          title="Утвердить"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                      {file.category !== "PENDING_APPROVAL" && (
                        <button
                          onClick={() => changeCategory(file.id, "PENDING_APPROVAL")}
                          className="p-1.5 rounded hover:bg-yellow-50 text-yellow-500 transition-colors"
                          title="На согласование"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => openComments(file)}
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-400 transition-colors"
                        title="Комментарии"
                      >
                        <MessageSquare size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(file.id, file.originalName)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors"
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
        </Card>
      )}

      {/* Comments panel */}
      {commentFile && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setCommentFile(null)} />
          <div className="w-full max-w-sm bg-white shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{commentFile.originalName}</p>
                <p className="text-xs text-gray-400">Комментарии</p>
              </div>
              <button onClick={() => setCommentFile(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {commentsLoading ? (
                <p className="text-xs text-gray-400 text-center py-8">Загрузка...</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">Комментариев пока нет</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-violet-600">{c.user.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-gray-800">{c.user.name}</span>
                        <span className="text-[11px] text-gray-400">{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={submitComment} className="px-4 py-3 border-t border-gray-100 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Написать комментарий..."
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || sendingComment}
                className="p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Upload modal */}
      <Modal isOpen={uploadModalOpen} onClose={() => { setUploadModalOpen(false); setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} title="Загрузить файл">
        <div className="space-y-4">
          {uploadFile && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
              <span className="font-medium">{uploadFile.name}</span>
              <span className="text-gray-400 ml-2">({formatFileSize(uploadFile.size)})</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Привязать к (необязательно)</label>
            <div className="flex gap-2 mb-2">
              {[["", "Без привязки"], ["ORDER", "Заявка"], ["TASK", "Задача"]].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setUploadLinkedTo(v); setUploadLinkedId(""); }}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${uploadLinkedTo === v ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-600 border-gray-200 hover:border-violet-300"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            {uploadLinkedTo === "ORDER" && (
              <select
                value={uploadLinkedId}
                onChange={(e) => setUploadLinkedId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">— выберите заявку —</option>
                {uploadOrders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}
              </select>
            )}
            {uploadLinkedTo === "TASK" && (
              <select
                value={uploadLinkedId}
                onChange={(e) => setUploadLinkedId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">— выберите задачу —</option>
                {uploadTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => { setUploadModalOpen(false); setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>Отмена</Button>
            <Button onClick={confirmUpload} loading={uploadLoading}>
              <Upload size={14} /> Загрузить
            </Button>
          </div>
        </div>
      </Modal>

      {/* Preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => { setPreviewUrl(null); setPreviewType(null); }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-800 truncate">{previewName}</p>
              <button
                onClick={() => { setPreviewUrl(null); setPreviewType(null); }}
                className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-50 min-h-64">
              {previewType === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={previewName} className="max-w-full max-h-full object-contain rounded" />
              )}
              {previewType === "pdf" && (
                <iframe src={previewUrl} className="w-full h-full min-h-[70vh] rounded" title={previewName} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
