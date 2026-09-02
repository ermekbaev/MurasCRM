"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatDateTime } from "@/lib/utils";
import {
  MessagesSquare,
  Send,
  Link2,
  Plus,
  Search,
  Paperclip,
  FileText,
  Download,
  AlertCircle,
  Bell,
  BellOff,
  Zap,
  X,
} from "lucide-react";

interface Party {
  id: string;
  name: string;
}

interface Attachment {
  id: string;
  kind: "PHOTO" | "DOCUMENT" | "VOICE" | "VIDEO" | "AUDIO" | "STICKER";
  name: string;
  mimeType: string;
  size: number;
  available: boolean;
  failReason: string | null;
}

type Channel = "TELEGRAM" | "WHATSAPP";

interface ConversationRow {
  id: string;
  channel: Channel;
  title: string;
  username: string | null;
  unread: number;
  lastMessageAt: string;
  lastMessage: string;
  client: Party | null;
  order: { id: string; number: string } | null;
}

interface Message {
  id: string;
  direction: "IN" | "OUT";
  text: string;
  userName: string | null;
  createdAt: string;
  attachments: Attachment[];
}

interface Thread extends ConversationRow {
  messages: Message[];
  /** Для WhatsApp — можно ли сейчас писать свободным текстом. */
  window: { open: boolean; expiresAt: string | null };
}

interface QuickReply {
  id: string;
  title: string;
  text: string;
}

const MAX_UPLOAD = 20 * 1024 * 1024;

const CHANNEL_LABEL: Record<Channel, string> = {
  TELEGRAM: "Telegram",
  WHATSAPP: "WhatsApp",
};

/** Метка канала: диалоги из разных мессенджеров лежат в одном списке. */
function ChannelBadge({ channel }: { channel: Channel }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
        channel === "WHATSAPP"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
      }`}
    >
      {CHANNEL_LABEL[channel]}
    </span>
  );
}

/** Подпись раздела: сколько диалогов и из каких мессенджеров. */
function channelSummary(list: ConversationRow[]): string {
  const used = (Object.keys(CHANNEL_LABEL) as Channel[]).filter((c) =>
    list.some((row) => row.channel === c),
  );
  const channels = used.length > 0 ? used.map((c) => CHANNEL_LABEL[c]) : ["Telegram"];
  return `${list.length} диалогов · ${channels.join(", ")}`;
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function ChatsPage() {
  const [list, setList] = useState<ConversationRow[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [clients, setClients] = useState<Party[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQuick, setShowQuick] = useState(false);
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notify, setNotify] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Поток обновлений приходит с сервера, а обработчик должен видеть открытый
  // диалог — держим его в ссылке, иначе подписка тянула бы старое значение.
  const threadIdRef = useRef<string | null>(null);
  const notifyRef = useRef(false);
  const queryRef = useRef("");

  const loadList = useCallback(async (q: string) => {
    const url = q ? `/api/conversations?q=${encodeURIComponent(q)}` : "/api/conversations";
    const data = await fetch(url).then((r) => (r.ok ? r.json() : []));
    setList(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  const openThread = useCallback(async (id: string) => {
    const data = await fetch(`/api/conversations/${id}`).then((r) => (r.ok ? r.json() : null));
    if (!data) return;
    threadIdRef.current = id;
    setThread(data);
    setError(null);
    // Прочитанное сразу гасим в списке, не дожидаясь перезагрузки.
    setList((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }, []);

  useEffect(() => {
    setNotify(
      typeof Notification !== "undefined" && Notification.permission === "granted",
    );
    fetch("/api/clients?limit=200")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setClients(d?.clients ?? []))
      .catch(() => {});
    fetch("/api/settings/quick-replies")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setQuickReplies(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  // Поиск: ждём паузы в наборе, чтобы не дёргать сервер на каждой букве.
  useEffect(() => {
    const t = setTimeout(() => loadList(query.trim()), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, loadList]);

  // Строку поиска держим в ссылке: подписка на поток не должна пересоздаваться
  // при наборе, иначе каждая буква рвёт соединение и события теряются.
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  // Живое обновление. Сервер шлёт только сигнал «изменилось» — содержимое
  // забираем обычными запросами, чтобы права и формат жили в одном месте.
  useEffect(() => {
    let source: EventSource | null = null;
    let fallback: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const refresh = (incoming: boolean) => {
      loadList(queryRef.current.trim());
      const open = threadIdRef.current;
      if (open) openThread(open);
      if (incoming && notifyRef.current && document.hidden) {
        try {
          new Notification("Новое сообщение", { body: "Клиент написал в переписке" });
        } catch {
          // На части браузеров уведомления доступны только через service worker.
        }
      }
    };

    const connect = () => {
      if (stopped) return;
      source = new EventSource("/api/conversations/stream");

      source.addEventListener("chat", (e) => {
        const data = JSON.parse((e as MessageEvent).data || "{}");
        refresh(data.direction === "IN");
      });

      source.onerror = () => {
        // Поток оборвался. Пока переподключаемся — опрашиваем по таймеру, чтобы
        // переписка не замерла, если SSE недоступен совсем.
        source?.close();
        source = null;
        if (!stopped && !fallback) fallback = setInterval(() => refresh(false), 15000);
        retry = setTimeout(() => {
          if (stopped) return;
          if (fallback) {
            clearInterval(fallback);
            fallback = null;
          }
          connect();
        }, 10000);
      };
    };

    connect();
    return () => {
      stopped = true;
      source?.close();
      if (fallback) clearInterval(fallback);
      if (retry) clearTimeout(retry);
    };
  }, [loadList, openThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  // Счётчик в заголовке вкладки — видно, даже когда CRM в фоне.
  useEffect(() => {
    const total = list.reduce((sum, c) => sum + c.unread, 0);
    document.title = total > 0 ? `(${total}) Переписка` : "Переписка";
    // Уходя со страницы, счётчик убираем: иначе он висит в заголовке вкладки
    // на всех остальных разделах.
    return () => {
      document.title = "Muras-Brand CRM";
    };
  }, [list]);

  async function requestNotifications() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      setNotify((v) => !v);
      return;
    }
    const result = await Notification.requestPermission();
    setNotify(result === "granted");
  }

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.size > MAX_UPLOAD) {
      setError(`Файл больше ${MAX_UPLOAD / 1024 / 1024} МБ — отправьте его через файлы заявки`);
      return;
    }
    setError(null);
    setFile(f);
  }

  async function send() {
    if (!thread || (!text.trim() && !file)) return;
    setSending(true);
    setError(null);
    try {
      let res: Response;
      if (file) {
        const form = new FormData();
        form.append("text", text.trim());
        form.append("file", file);
        res = await fetch(`/api/conversations/${thread.id}/messages`, {
          method: "POST",
          body: form,
        });
      } else {
        res = await fetch(`/api/conversations/${thread.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });
      }

      if (!res.ok) {
        const b = await res.json().catch(() => null);
        setError(typeof b?.error === "string" ? b.error : "Не удалось отправить");
        return;
      }
      const msg: Message = await res.json();
      setThread((t) => (t ? { ...t, messages: [...t.messages, msg] } : t));
      setText("");
      setFile(null);
      loadList(query.trim());
    } finally {
      setSending(false);
    }
  }

  async function linkClient(clientId: string) {
    if (!thread) return;
    const res = await fetch(`/api/conversations/${thread.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: clientId || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setThread((t) => (t ? { ...t, client: updated.client } : t));
      loadList(query.trim());
    }
  }

  /** Заявка из переписки: клиент подставляется, текст уходит в описание. */
  function orderFromChat() {
    if (!thread) return;
    const recent = thread.messages
      .slice(-10)
      .map((m) => {
        const who = m.direction === "IN" ? thread.title : m.userName ?? "Мы";
        const files = m.attachments.map((a) => `[${a.name}]`).join(" ");
        return `${who}: ${[m.text, files].filter(Boolean).join(" ")}`;
      })
      .join("\n");
    const params = new URLSearchParams({
      fromChat: thread.id,
      ...(thread.client ? { clientId: thread.client.id } : {}),
      notes: `Из переписки (${thread.title}):\n${recent}`,
    });
    window.location.href = `/orders?${params.toString()}`;
  }

  if (loading) return <div className="p-6 text-fg-subtle">Загрузка...</div>;

  const nothingFound = list.length === 0 && query.trim().length > 0;
  // Окно есть только у WhatsApp: в Telegram отвечать можно когда угодно.
  const windowClosed = Boolean(
    thread && thread.channel === "WHATSAPP" && !thread.window?.open,
  );

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        icon={<MessagesSquare size={18} />}
        title="Переписка"
        subtitle={channelSummary(list)}
        actions={
          <Button
            variant="outline"
            onClick={requestNotifications}
            title="Уведомления браузера о новых сообщениях"
          >
            {notify ? <Bell size={15} /> : <BellOff size={15} />}
            {notify ? "Уведомления включены" : "Уведомления"}
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени, клиенту или тексту переписки"
          className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-fg outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
        />
      </div>

      {list.length === 0 ? (
        <Card padding="md">
          <div className="py-10 text-center">
            <MessagesSquare size={36} className="mx-auto mb-3 text-fg-subtle opacity-30" />
            {nothingFound ? (
              <p className="text-sm text-fg">Ничего не нашлось</p>
            ) : (
              <>
                <p className="text-sm text-fg">Диалогов пока нет</p>
                <p className="mx-auto mt-2 max-w-lg text-xs text-fg-muted">
                  Переписка появится, когда клиент напишет вашему боту в Telegram.
                  Бот не может написать первым — это ограничение Telegram, поэтому
                  дайте клиентам ссылку на бота: в подписи письма, на сайте или в счёте.
                </p>
              </>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Список диалогов */}
          <Card padding="none" className="lg:max-h-[70vh] lg:overflow-y-auto">
            <div className="divide-y divide-line-soft">
              {list.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openThread(c.id)}
                  className={`block w-full px-4 py-3 text-left transition-colors hover:bg-surface-hover ${
                    thread?.id === c.id ? "bg-accent-soft" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-fg">{c.title}</span>
                    <ChannelBadge channel={c.channel} />
                    {c.unread > 0 && (
                      <span className="shrink-0 rounded-full bg-accent px-1.5 text-[11px] font-medium text-white">
                        {c.unread}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-fg-muted">{c.lastMessage}</p>
                  <p className="mt-0.5 text-[11px] text-fg-subtle">
                    {c.client ? c.client.name : "клиент не привязан"}
                  </p>
                </button>
              ))}
            </div>
          </Card>

          {/* Переписка */}
          <Card
            padding="none"
            className={`relative flex flex-col lg:col-span-2 lg:h-[70vh] ${
              dragOver ? "ring-2 ring-accent" : ""
            }`}
            onDragOver={(e) => {
              if (!thread) return;
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              if (!thread) return;
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            {!thread ? (
              <p className="p-6 text-sm text-fg-subtle">Выберите диалог слева</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold text-fg">
                      {thread.title}
                      <ChannelBadge channel={thread.channel} />
                      {thread.username && (
                        <span className="ml-2 text-xs font-normal text-fg-subtle">
                          {thread.username}
                        </span>
                      )}
                    </p>
                    {thread.order && (
                      <Link
                        href={`/orders/${thread.order.id}`}
                        className="text-xs text-accent hover:underline"
                      >
                        заявка {thread.order.number}
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={thread.client?.id ?? ""}
                      onChange={(e) => linkClient(e.target.value)}
                      className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-fg outline-none focus:border-accent"
                    >
                      <option value="">Привязать клиента…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <Button size="sm" variant="outline" onClick={orderFromChat}>
                      <Plus size={14} /> Заявка
                    </Button>
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                  {thread.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.direction === "OUT" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                          m.direction === "OUT"
                            ? "bg-accent-soft text-fg"
                            : "bg-surface-hover text-fg"
                        }`}
                      >
                        {m.attachments.length > 0 && (
                          <div className="mb-1.5 space-y-1.5">
                            {m.attachments.map((a) => (
                              <AttachmentView key={a.id} attachment={a} />
                            ))}
                          </div>
                        )}
                        {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                        <p className="mt-1 text-[10px] text-fg-subtle">
                          {m.direction === "OUT" && m.userName ? `${m.userName} · ` : ""}
                          {formatDateTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {error && (
                  <p className="border-t border-line-soft bg-red-50 px-4 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                    {error}
                  </p>
                )}

                {windowClosed ? (
                  <div className="border-t border-line-soft px-4 py-3">
                    <p className="flex items-start gap-2 text-xs text-fg-muted">
                      <AlertCircle size={14} className="mt-px shrink-0 text-amber-500" />
                      <span>
                        Прошло больше 24 часов с последнего сообщения клиента.
                        WhatsApp разрешает писать первым только заранее одобренными
                        шаблонами — они платные и согласуются в Meta. Напишите клиенту
                        в Telegram или позвоните: как только он ответит здесь, переписка
                        снова откроется на сутки.
                      </span>
                    </p>
                  </div>
                ) : (
                  <>
                {showQuick && quickReplies.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border-t border-line-soft">
                    {quickReplies.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setText((prev) => (prev ? `${prev}\n${r.text}` : r.text));
                          setShowQuick(false);
                        }}
                        className="block w-full px-4 py-2 text-left hover:bg-surface-hover"
                      >
                        <span className="text-xs font-medium text-fg">{r.title}</span>
                        <span className="ml-2 text-xs text-fg-subtle">
                          {r.text.slice(0, 60)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {file && (
                  <div className="flex items-center gap-2 border-t border-line-soft px-4 py-2 text-xs text-fg-muted">
                    <FileText size={14} />
                    <span className="truncate">{file.name}</span>
                    <span className="text-fg-subtle">{formatSize(file.size)}</span>
                    <button
                      onClick={() => setFile(null)}
                      className="ml-auto rounded p-1 hover:bg-surface-hover"
                      title="Убрать файл"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2 border-t border-line-soft p-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Прикрепить файл (до 20 МБ)"
                    className="rounded-lg p-2 text-fg-muted hover:bg-surface-hover"
                  >
                    <Paperclip size={17} />
                  </button>
                  {quickReplies.length > 0 && (
                    <button
                      onClick={() => setShowQuick((v) => !v)}
                      title="Быстрые ответы"
                      className={`rounded-lg p-2 hover:bg-surface-hover ${
                        showQuick ? "text-accent" : "text-fg-muted"
                      }`}
                    >
                      <Zap size={17} />
                    </button>
                  )}
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onPaste={(e) => {
                      // Скриншот из буфера — частый способ прислать правку.
                      const pasted = e.clipboardData.files?.[0];
                      if (pasted) pickFile(pasted);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={2}
                    placeholder="Ответ клиенту… Enter — отправить, Shift+Enter — перенос строки"
                    className="flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
                  />
                  <Button onClick={send} loading={sending} disabled={!text.trim() && !file}>
                    <Send size={16} />
                  </Button>
                </div>
                  </>
                )}
              </>
            )}

            {dragOver && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-accent-soft/80 text-sm font-medium text-accent-fg">
                Отпустите файл — он уйдёт клиенту
              </div>
            )}
          </Card>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
        <Link2 size={12} />
        Клиент привязывается автоматически, если его Telegram указан в карточке.
      </p>
    </div>
  );
}

/** Вложение в переписке: картинка показывается, остальное — ссылкой. */
function AttachmentView({ attachment }: { attachment: Attachment }) {
  const href = `/api/conversations/attachments/${attachment.id}?raw=1`;

  if (!attachment.available) {
    return (
      <div className="flex items-start gap-1.5 rounded-lg border border-line-soft px-2 py-1.5 text-xs text-fg-muted">
        <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-500" />
        <span>
          {attachment.name}
          <span className="block text-fg-subtle">
            {attachment.failReason ?? "файл не сохранён"}
          </span>
        </span>
      </div>
    );
  }

  const isImage =
    attachment.mimeType.startsWith("image/") ||
    attachment.kind === "PHOTO" ||
    attachment.kind === "STICKER";

  if (isImage) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        {/* Обычный img: файл отдаётся по подписанной ссылке через наш обработчик,
            оптимизатор Next.js такие адреса не пропускает. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt={attachment.name}
          className="max-h-56 w-auto rounded-lg border border-line-soft"
        />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg border border-line-soft px-2 py-1.5 text-xs text-fg hover:bg-surface-hover"
    >
      <FileText size={14} className="shrink-0 text-fg-muted" />
      <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
      <span className="shrink-0 text-fg-subtle">{formatSize(attachment.size)}</span>
      <Download size={13} className="shrink-0 text-fg-muted" />
    </a>
  );
}
