"use client";

import { useEffect, useState } from "react";
import { CLIENT_SOURCE_LABELS } from "@/lib/constants";

export interface SourceOption {
  value: string;
  label: string;
}

const FALLBACK: SourceOption[] = Object.entries(CLIENT_SOURCE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

/**
 * Справочник источников клиента из настроек.
 * Если справочник пуст или недоступен, отдаём встроенные подписи — форма
 * не должна оставаться без вариантов выбора.
 */
export function useClientSources() {
  const [options, setOptions] = useState<SourceOption[]>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/client-sources")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { code: string; label: string; isActive: boolean }[]) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data.filter((s) => s.isActive) : [];
        if (list.length > 0) {
          setOptions(list.map((s) => ({ value: s.code, label: s.label })));
        }
      })
      .catch(() => {
        /* остаются встроенные подписи */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const labels: Record<string, string> = {
    ...CLIENT_SOURCE_LABELS,
    ...Object.fromEntries(options.map((o) => [o.value, o.label])),
  };

  return { options, labels };
}
