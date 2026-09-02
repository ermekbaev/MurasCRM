"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatDateTime } from "@/lib/utils";
import { MessagesSquare, Send, Link2, Plus, RefreshCw } from "lucide-react";

interface Party {
  id: string;
  name: string;
}

interface ConversationRow {
  id: string;
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
}

interface Thread extends ConversationRow {
  messages: Message[];
}

export default function ChatsPage() {
  const [list, setList] = useState<ConversationRow[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [clients, setClients] = useState<Party[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    const data = await fetch("/api/conversations").then((r) => (r.ok ? r.json() : []));
    setList(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  const openThread = useCallback(async (id: string) => {
    const data = await fetch(`/api/conversations/${id}`).then((r) => (r.ok ? r.json() : null));
    if (!data) return;
    setThread(data);
    setError(null);
    // Прочитанное сразу гасим в списке, не дожидаясь перезагрузки.
    setList((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }, []);

  useEffect(() => {
    loadList();
    fetch("/api/clients?limit=200")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setClients(d?.clients ?? []))
      .catch(() => {});
  }, [loadList]);

  // Новые сообщения приходят от клиента в любой момент — подтягиваем список.
  useEffect(() => {
    const t = setInterval(() => {
      loadList();
      if (thread) openThread(thread.id);
    }, 15000);
    return () => clearInterval(t);
  }, [loadList, openThread, thread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  async function send() {
    if (!thread || !text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${thread.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        setError(typeof b?.error === "string" ? b.error : "Не удалось отправить");
        return;
      }
      const msg: Message = await res.json();
      setThread((t) => (t ? { ...t, messages: [...t.messages, msg] } : t));
      setText("");
      loadList();
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
      loadList();
    }
  }

  /** Заявка из переписки: клиент подставляется, текст уходит в описание. */
  function orderFromChat() {
    if (!thread) return;
    const recent = thread.messages
      .slice(-10)
      .map((m) => `${m.direction === "IN" ? thread.title : m.userName ?? "Мы"}: ${m.text}`)
      .join("\n");
    const params = new URLSearchParams({
      fromChat: thread.id,
      ...(thread.client ? { clientId: thread.client.id } : {}),
      notes: `Из переписки (${thread.title}):\n${recent}`,
    });
    window.location.href = `/orders?${params.toString()}`;
  }

  if (loading) return <div className="p-6 text-fg-subtle">Загрузка...</div>;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        icon={<MessagesSquare size={18} />}
        title="Переписка"
        subtitle={`${list.length} диалогов · Telegram`}
        actions={
          <Button variant="outline" onClick={loadList}>
            <RefreshCw size={15} /> Обновить
          </Button>
        }
      />

      {list.length === 0 ? (
        <Card padding="md">
          <div className="py-10 text-center">
            <MessagesSquare size={36} className="mx-auto mb-3 text-fg-subtle opacity-30" />
            <p className="text-sm text-fg">Диалогов пока нет</p>
            <p className="mx-auto mt-2 max-w-lg text-xs text-fg-muted">
              Переписка появится, когда клиент напишет вашему боту в Telegram.
              Бот не может написать первым — это ограничение Telegram, поэтому
              дайте клиентам ссылку на бота: в подписи письма, на сайте или в счёте.
            </p>
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
          <Card padding="none" className="flex flex-col lg:col-span-2 lg:h-[70vh]">
            {!thread ? (
              <p className="p-6 text-sm text-fg-subtle">Выберите диалог слева</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">
                      {thread.title}
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
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
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

                <div className="flex items-end gap-2 border-t border-line-soft p-3">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
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
                  <Button onClick={send} loading={sending} disabled={!text.trim()}>
                    <Send size={16} />
                  </Button>
                </div>
              </>
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
