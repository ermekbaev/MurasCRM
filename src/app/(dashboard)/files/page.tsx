"use client";

import { useState, useEffect, useRef } from "react";
import { formatDate, formatFileSize } from "@/lib/utils";
import { FILE_CATEGORY_LABELS, FILE_STATUS_LABELS, ALLOWED_FILE_TYPES } from "@/lib/constants";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import {
  FolderOpen, Folder, Upload, Download, Search, File, Image, FileText, AlertCircle,
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

type FolderKey = "SOURCES" | "PENDING_APPROVAL" | "APPROVED" | "READY" | "ARCHIVE";

const FOLDER_META: Record<FolderKey, { color: string; iconColor: string; bg: string }> = {
  SOURCES:          { color: "text-blue-700 dark:text-blue-300",   iconColor: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-900/20" },
  PENDING_APPROVAL: { color: "text-yellow-700 dark:text-yellow-300", iconColor: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/20" },
  APPROVED:         { color: "text-green-700 dark:text-green-300",  iconColor: "text-green-500",  bg: "bg-green-50 dark:bg-green-900/20" },
  READY:            { color: "text-accent-fg", iconColor: "text-accent", bg: "bg-accent-soft" },
  ARCHIVE:          { color: "text-fg-muted",   iconColor: "text-fg-subtle",   bg: "bg-surface-sunken" },
};

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image size={16} className="text-blue-500" />;
  if (mimeType === "application/pdf") return <FileText size={16} className="text-red-500" />;
  return <File size={16} className="text-fg-muted" />;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openFolder, setOpenFolder] = useState<FolderKey | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "pdf" | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [replacingFileId, setReplacingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);
  const previewOverlayRef = useRef<HTMLDivElement>(null);
  const previewMouseDownOnOverlay = useRef(false);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLinkedTo, setUploadLinkedTo] = useState("");
  const [uploadLinkedId, setUploadLinkedId] = useState("");
  const [uploadOrders, setUploadOrders] = useState<{ id: string; number: string }[]>([]);
  const [uploadTasks, setUploadTasks] = useState<{ id: string; title: string }[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);

  const [commentFile, setCommentFile] = useState<FileRecord | null>(null);
  const [comments, setComments] = useState<FileComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    fetch("/api/files")
      .then((r) => r.json())
      .then((data) => { setFiles(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

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
          category: openFolder || "SOURCES",
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
          category: openFolder || "SOURCES",
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
    setPreviewType(file.mimeType.startsWith("image/") ? "image" : "pdf");
    setPreviewUrl(url);
  }

  function canPreview(mimeType: string) {
    return mimeType.startsWith("image/") || mimeType === "application/pdf";
  }

  const folderKeys = Object.keys(FILE_CATEGORY_LABELS) as FolderKey[];

  const folderFiles = openFolder
    ? files.filter((f) => {
        const matchCat = f.category === openFolder;
        const matchSearch = !search || f.originalName.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
      })
    : [];

  const totalSize = (cat: FolderKey) =>
    files.filter((f) => f.category === cat).reduce((s, f) => s + f.size, 0);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept={ALLOWED_FILE_TYPES.join(",")} onChange={handleFileUpload} className="hidden" />
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

      {/* Header */}
      <PageHeader
        icon={<FolderOpen size={18} className="text-accent" />}
        onBack={
          openFolder
            ? { onClick: () => { setOpenFolder(null); setSearch(""); }, label: "Файловый хаб" }
            : undefined
        }
        title={openFolder ? FILE_CATEGORY_LABELS[openFolder] : "Файловый хаб"}
        subtitle={
          openFolder
            ? `${files.filter((f) => f.category === openFolder).length} файлов`
            : `${files.length} файлов в ${folderKeys.length} папках`
        }
        actions={
          <Button onClick={() => fileInputRef.current?.click()} loading={uploading}>
            <Upload size={16} /> Загрузить файл
          </Button>
        }
      />

      {/* Folder grid view */}
      {!openFolder && (
        loading ? (
          <div className="text-center py-16 text-fg-subtle">Загрузка...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {folderKeys.map((key) => {
              const count = files.filter((f) => f.category === key).length;
              const meta = FOLDER_META[key];
              return (
                <button
                  key={key}
                  onClick={() => setOpenFolder(key)}
                  className="group text-left p-5 rounded-xl border border-line-soft bg-surface hover:border-accent/40 hover:shadow-md transition-all"
                >
                  <div className={`w-12 h-12 rounded-xl ${meta.bg} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                    <Folder size={24} className={meta.iconColor} />
                  </div>
                  <p className={`font-semibold text-sm leading-tight ${meta.color}`}>
                    {FILE_CATEGORY_LABELS[key]}
                  </p>
                  <p className="text-xs text-fg-subtle mt-1">{count} файлов</p>
                  {count > 0 && (
                    <p className="text-xs text-fg-subtle mt-0.5">{formatFileSize(totalSize(key))}</p>
                  )}
                </button>
              );
            })}
          </div>
        )
      )}

      {/* Folder contents */}
      {openFolder && (
        <>
          {/* Search inside folder */}
          <Card padding="sm">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <input
                type="text"
                placeholder="Поиск файлов..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-line rounded-lg bg-surface text-fg focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 bg-surface text-fg"
              />
            </div>
          </Card>

          {folderFiles.length === 0 ? (
            <Card padding="md" className="text-center py-12">
              <FolderOpen size={40} className="mx-auto text-fg-subtle/50 mb-3" />
              <p className="text-fg-subtle text-sm">
                {search ? "Ничего не найдено" : "Папка пустая"}
              </p>
              {!search && (
                <p className="text-xs text-fg-subtle mt-1">
                  Нажмите «Загрузить файл» чтобы добавить
                </p>
              )}
            </Card>
          ) : (
            <Card padding="none">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-soft bg-surface-sunken">
                    <th className="text-left px-5 py-3 text-xs font-medium text-fg-muted uppercase">Файл</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-fg-muted uppercase">Статус</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-fg-muted uppercase">Размер</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-fg-muted uppercase">Загрузил</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-fg-muted uppercase">Дата</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-fg-muted uppercase">Переместить</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {folderFiles.map((file) => (
                    <tr key={file.id} className="hover:bg-surface-hover">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {getFileIcon(file.mimeType)}
                          <div>
                            <p className="font-medium text-fg text-sm truncate max-w-48">
                              {file.originalName}
                            </p>
                            {file.version > 1 && (
                              <span className="text-xs text-accent">v{file.version}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 bg-surface-hover text-fg-muted rounded-full">
                          {FILE_STATUS_LABELS[file.status as keyof typeof FILE_STATUS_LABELS]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-fg-muted">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="px-4 py-3 text-xs text-fg-muted">
                        {file.uploadedBy.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-fg-muted">
                        {formatDate(file.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={file.category}
                          onChange={(e) => changeCategory(file.id, e.target.value)}
                          className="text-xs border border-line rounded-lg px-2 py-1 bg-surface text-fg-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 bg-surface text-fg"
                        >
                          {folderKeys.map((k) => (
                            <option key={k} value={k}>{FILE_CATEGORY_LABELS[k]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          {canPreview(file.mimeType) && (
                            <button
                              onClick={() => previewFile(file)}
                              className="p-1.5 rounded hover:bg-surface-hover text-fg-muted transition-colors"
                              title="Просмотр"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => downloadFile(file)}
                            className="p-1.5 rounded hover:bg-accent-soft text-accent transition-colors"
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
              </div>
            </Card>
          )}
        </>
      )}

      {/* Comments panel */}
      {commentFile && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setCommentFile(null)} />
          <div className="w-full max-w-sm bg-surface shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg truncate">{commentFile.originalName}</p>
                <p className="text-xs text-fg-subtle">Комментарии</p>
              </div>
              <button onClick={() => setCommentFile(null)} className="p-1 rounded hover:bg-surface-hover text-fg-subtle">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {commentsLoading ? (
                <p className="text-xs text-fg-subtle text-center py-8">Загрузка...</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-fg-subtle text-center py-8">Комментариев пока нет</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <div className="w-7 h-7 bg-accent-soft rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-accent">{c.user.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-fg">{c.user.name}</span>
                        <span className="text-[11px] text-fg-subtle">{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-fg-muted mt-0.5 whitespace-pre-wrap">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={submitComment} className="px-4 py-3 border-t border-line-soft flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Написать комментарий..."
                className="flex-1 text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 bg-surface text-fg"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || sendingComment}
                className="p-2 rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Upload modal */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => { setUploadModalOpen(false); setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
        title="Загрузить файл"
      >
        <div className="space-y-4">
          {uploadFile && (
            <div className="p-3 bg-surface-sunken rounded-lg text-sm text-fg-muted">
              <span className="font-medium">{uploadFile.name}</span>
              <span className="text-fg-subtle ml-2">({formatFileSize(uploadFile.size)})</span>
            </div>
          )}
          {openFolder && (
            <div className="flex items-center gap-2 text-sm text-fg-muted">
              <Folder size={14} className={FOLDER_META[openFolder].iconColor} />
              Папка: <span className="font-medium text-fg-muted">{FILE_CATEGORY_LABELS[openFolder]}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-fg-muted mb-1">Привязать к (необязательно)</label>
            <div className="flex gap-2 mb-2">
              {[["", "Без привязки"], ["ORDER", "Заявка"], ["TASK", "Задача"]].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setUploadLinkedTo(v); setUploadLinkedId(""); }}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${uploadLinkedTo === v ? "bg-accent text-white border-violet-600" : "bg-surface text-fg-muted border-line hover:border-violet-300"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            {uploadLinkedTo === "ORDER" && (
              <select
                value={uploadLinkedId}
                onChange={(e) => setUploadLinkedId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-surface text-fg focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 bg-surface text-fg"
              >
                <option value="">— выберите заявку —</option>
                {uploadOrders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}
              </select>
            )}
            {uploadLinkedTo === "TASK" && (
              <select
                value={uploadLinkedId}
                onChange={(e) => setUploadLinkedId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-surface text-fg focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 bg-surface text-fg"
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
          ref={previewOverlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(e) => {
            previewMouseDownOnOverlay.current = e.target === previewOverlayRef.current;
          }}
          onMouseUp={(e) => {
            if (previewMouseDownOnOverlay.current && e.target === previewOverlayRef.current) {
              setPreviewUrl(null); setPreviewType(null);
            }
            previewMouseDownOnOverlay.current = false;
          }}
        >
          <div
            className="bg-surface rounded-xl shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft">
              <p className="text-sm font-medium text-fg truncate">{previewName}</p>
              <button
                onClick={() => { setPreviewUrl(null); setPreviewType(null); }}
                className="p-1 rounded hover:bg-surface-hover text-fg-muted transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-surface-sunken min-h-64">
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
