"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Bot, Check, Copy, Link2, Unlink, Send, Mic } from "lucide-react";

interface UserRow {
  id: string;
  name: string;
  role: string;
  telegramChatId: string | null;
  aliceUserId: string | null;
  linkCode: string | null;
  isBlocked: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
  ACCOUNTANT: "Бухгалтер",
  DESIGNER: "Дизайнер",
  OPERATOR: "Оператор",
};

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg-muted transition-colors hover:border-accent/40 hover:text-accent"
    >
      {done ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
      {done ? "Скопировано" : label ?? "Копировать"}
    </button>
  );
}

export default function BotSettingsPage() {
  const [tg, setTg] = useState<{ configured: boolean; username?: string | null; webhook?: { url?: string; last_error_message?: string } | null; webhookUrl?: string } | null>(null);
  const [alice, setAlice] = useState<{ enabled: boolean; url: string | null } | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [token, setToken] = useState("");
  const [tgBusy, setTgBusy] = useState(false);
  const [tgError, setTgError] = useState<string | null>(null);
  const [aliceBusy, setAliceBusy] = useState(false);

  async function loadAll() {
    const [t, a, u] = await Promise.all([
      fetch("/api/settings/telegram").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings/alice").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/users").then((r) => (r.ok ? r.json() : [])),
    ]);
    setTg(t);
    setAlice(a);
    setUsers(Array.isArray(u) ? u.filter((x: UserRow) => !x.isBlocked) : []);
    setLoading(false);
  }

  useEffect(() => {
    // setState происходит после await внутри loadAll, не синхронно.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, []);

  async function connectTelegram() {
    setTgBusy(true);
    setTgError(null);
    const res = await fetch("/api/settings/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim() }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setToken("");
      await loadAll();
    } else {
      setTgError(typeof data?.error === "string" ? data.error : "Не удалось подключить бота");
    }
    setTgBusy(false);
  }

  async function disconnectTelegram() {
    if (!confirm("Отключить Telegram-бота? Уведомления и команды перестанут работать.")) return;
    setTgBusy(true);
    await fetch("/api/settings/telegram", { method: "DELETE" });
    await loadAll();
    setTgBusy(false);
  }

  async function toggleAlice(on: boolean) {
    setAliceBusy(true);
    await fetch("/api/settings/alice", { method: on ? "POST" : "DELETE" });
    await loadAll();
    setAliceBusy(false);
  }

  async function genCode(userId: string) {
    const res = await fetch(`/api/users/${userId}/link-code`, { method: "POST" });
    if (res.ok) {
      const { code } = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, linkCode: code } : u)));
    }
  }

  async function unlink(userId: string) {
    if (!confirm("Отвязать Telegram/Алису у сотрудника?")) return;
    const res = await fetch(`/api/users/${userId}/link-code`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, telegramChatId: null, aliceUserId: null, linkCode: null } : u)),
      );
    }
  }

  if (loading) return <div className="p-6 text-fg-subtle">Загрузка...</div>;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={<Bot size={18} />}
        title="Бот и голос"
        subtitle="Telegram-бот и Алиса: уведомления и создание задач/клиентов голосом"
        back={{ href: "/settings", label: "Настройки" }}
      />

      <div className="space-y-5">
        {/* Telegram */}
        <Card padding="md">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-fg">
            <Send size={16} className="text-accent" /> Telegram-бот
          </h2>
          {tg?.configured ? (
            <div className="space-y-3">
              <p className="text-sm text-fg-muted">
                Подключён{tg.username ? <>: <span className="font-medium text-fg">@{tg.username}</span></> : null}.
                {tg.webhook?.url ? " Вебхук активен." : " Вебхук не зарегистрирован."}
              </p>
              {tg.webhook?.last_error_message && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
                  Последняя ошибка Telegram: {tg.webhook.last_error_message}
                </p>
              )}
              <Button variant="outline" onClick={disconnectTelegram} loading={tgBusy}>
                Отключить
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-fg-muted">
                Создайте бота у <span className="font-medium text-fg">@BotFather</span> в Telegram, скопируйте токен и вставьте сюда — подключение и вебхук настроятся сами.
              </p>
              {tgError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
                  {tgError}
                </p>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-64 flex-1">
                  <Input
                    label="Токен бота"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="123456:ABC-DEF..."
                  />
                </div>
                <Button onClick={connectTelegram} loading={tgBusy} disabled={token.trim().length < 20}>
                  Подключить
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Алиса */}
        <Card padding="md">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-fg">
            <Mic size={16} className="text-accent" /> Яндекс Алиса
          </h2>
          {alice?.enabled ? (
            <div className="space-y-3">
              <p className="text-sm text-fg-muted">
                Навык включён. В консоли Яндекс.Диалогов в поле «Webhook URL» вставьте адрес ниже:
              </p>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-sunken px-3 py-2">
                <code className="min-w-0 flex-1 break-all text-xs text-fg">{alice.url}</code>
                {alice.url && <CopyButton text={alice.url} />}
              </div>
              <p className="text-xs text-fg-subtle">
                Проверить можно прямо в консоли Диалогов (симулятор) или в приложении Яндекса — станция не обязательна.
              </p>
              <Button variant="outline" onClick={() => toggleAlice(false)} loading={aliceBusy}>
                Выключить
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-fg-muted">
                Включите навык, чтобы получить адрес вебхука для Яндекс.Диалогов. Распознавание речи — на стороне Яндекса.
              </p>
              <Button onClick={() => toggleAlice(true)} loading={aliceBusy}>
                Включить
              </Button>
            </div>
          )}
        </Card>

        {/* Привязка сотрудников */}
        <Card padding="none">
          <div className="border-b border-line-soft px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold text-fg">
              <Link2 size={16} className="text-accent" /> Привязка сотрудников
            </h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              Выдайте сотруднику код. В Telegram он пишет боту «код КОД», Алисе говорит «привяжи код КОД».
            </p>
          </div>
          <div className="divide-y divide-line-soft">
            {users.map((u) => {
              const linkedTg = Boolean(u.telegramChatId);
              const linkedAlice = Boolean(u.aliceUserId);
              return (
                <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{u.name}</p>
                    <p className="text-xs text-fg-subtle">{ROLE_LABELS[u.role] ?? u.role}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${linkedTg ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25" : "text-fg-subtle ring-line"}`}>
                      <Send size={11} /> {linkedTg ? "привязан" : "нет"}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${linkedAlice ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25" : "text-fg-subtle ring-line"}`}>
                      <Mic size={11} /> {linkedAlice ? "привязан" : "нет"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.linkCode ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent-soft px-2 py-1 font-mono text-xs font-semibold text-accent-fg">
                        код: {u.linkCode}
                        <CopyButton text={u.linkCode} label="" />
                      </span>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => genCode(u.id)}>
                        Выдать код
                      </Button>
                    )}
                    {(linkedTg || linkedAlice) && (
                      <button
                        onClick={() => unlink(u.id)}
                        title="Отвязать"
                        className="rounded-lg p-2 text-fg-subtle transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                      >
                        <Unlink size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
