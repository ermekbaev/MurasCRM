"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";

/** Форма ввода лицензионного ключа. Живёт на публичной странице /license. */
export default function LicenseForm() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState<{ expiresAt?: string } | null>(null);

  async function submit() {
    if (!key.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOk({ expiresAt: data.expiresAt });
        // Дать увидеть подтверждение и уйти в систему.
        setTimeout(() => router.replace("/dashboard"), 1200);
      } else {
        setError(typeof data.error === "string" ? data.error : "Не удалось активировать");
      }
    } catch {
      setError("Сеть недоступна, попробуйте ещё раз");
    } finally {
      setLoading(false);
    }
  }

  if (ok) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
        Лицензия активирована{ok.expiresAt ? ` до ${ok.expiresAt}` : ""}. Открываю систему…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Вставьте лицензионный ключ"
        rows={4}
        className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs text-fg focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={loading || !key.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Активировать
      </button>
    </div>
  );
}
