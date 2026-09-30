"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/layout/PageHeader";
import { DatabaseBackup, Download, RotateCcw, Loader2, Check, AlertTriangle } from "lucide-react";

interface Backup {
  key: string;
  name: string;
  size: number;
  createdAt: string | null;
  url: string | null;
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} КБ`;
  return `${(b / 1024 / 1024).toFixed(1)} МБ`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  // Восстановление: какой ключ подтверждаем и что вписали.
  const [restoreKey, setRestoreKey] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);

  async function load() {
    const res = await fetch("/api/backups").then((r) => (r.ok ? r.json() : null));
    setBackups(res?.backups ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createNow() {
    setCreating(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/cron/backup", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Не удалось сделать копию");
        return;
      }
      setOk("Копия создана");
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function restore() {
    if (!restoreKey) return;
    setRestoring(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: restoreKey, confirm: confirmText }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Не удалось восстановить");
        return;
      }
      setOk("База восстановлена из копии. Обновите страницу.");
      setRestoreKey(null);
      setConfirmText("");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<DatabaseBackup size={18} />}
        helpSlug="backups"
        title="Резервные копии"
        subtitle="Копии базы хранятся в облаке — сохранность данных не зависит от сервера"
        actions={
          <Button onClick={createNow} loading={creating}>
            <DatabaseBackup size={16} /> Создать копию сейчас
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}
      {ok && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Check size={15} /> {ok}
        </div>
      )}

      <Card padding="md">
        <p className="text-xs leading-relaxed text-fg-muted">
          Копия базы снимается автоматически каждый день и складывается в облачное
          хранилище. Здесь можно сделать копию вручную, скачать любую к себе или
          восстановить базу из копии. Хранятся последние 30 копий.
        </p>
      </Card>

      {loading ? (
        <div className="py-10 text-center text-fg-subtle">Загрузка...</div>
      ) : backups.length === 0 ? (
        <Card padding="md" className="py-12 text-center">
          <DatabaseBackup size={40} className="mx-auto mb-2 text-fg-subtle/50" />
          <p className="text-sm text-fg-subtle">Копий пока нет — нажмите «Создать копию сейчас»</p>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-soft bg-surface-sunken text-left text-xs uppercase text-fg-muted">
                  <th className="px-5 py-3 font-medium">Копия</th>
                  <th className="px-4 py-3 font-medium">Создана</th>
                  <th className="px-4 py-3 text-right font-medium">Размер</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {backups.map((b) => (
                  <tr key={b.key} className="hover:bg-surface-hover">
                    <td className="px-5 py-3 font-mono text-xs text-fg">{b.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-fg-muted">{fmtDate(b.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-fg-muted">{fmtSize(b.size)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {b.url && (
                          <a
                            href={b.url}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
                            title="Скачать копию"
                          >
                            <Download size={14} /> Скачать
                          </a>
                        )}
                        <button
                          onClick={() => { setRestoreKey(b.key); setConfirmText(""); setError(""); setOk(""); }}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
                          title="Восстановить базу из этой копии"
                        >
                          <RotateCcw size={14} /> Восстановить
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

      {/* Подтверждение восстановления */}
      {restoreKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setRestoreKey(null)}
        >
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-fg">Восстановить из копии?</h3>
                <p className="mt-1 text-xs text-fg-muted">
                  Текущие данные будут заменены содержимым копии. Отменить нельзя.
                  На всякий случай сначала можно «Создать копию сейчас».
                </p>
              </div>
            </div>
            <p className="mb-1.5 text-xs text-fg-muted">
              Впишите <b>ВОССТАНОВИТЬ</b> для подтверждения:
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ВОССТАНОВИТЬ"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRestoreKey(null)}>Отмена</Button>
              <button
                onClick={restore}
                disabled={confirmText !== "ВОССТАНОВИТЬ" || restoring}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {restoring ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                Восстановить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
