"use client";

import { useEffect, useState } from "react";
import { DEFAULT_TASK_COLUMNS, type TaskColumnDto } from "@/lib/taskColumns";

/**
 * Этапы задач из справочника настроек.
 * До ответа сервера (и при ошибке) отдаём встроенные этапы, чтобы доска
 * никогда не оставалась без колонок.
 */
export function useTaskColumns() {
  const [columns, setColumns] = useState<TaskColumnDto[]>(DEFAULT_TASK_COLUMNS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/task-columns")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TaskColumnDto[] | null) => {
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        setColumns(data);
      })
      .catch(() => {
        /* остаются встроенные этапы */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = columns.filter((c) => c.isActive);
  const labels: Record<string, string> = Object.fromEntries(
    columns.map((c) => [c.code, c.name]),
  );
  const colors: Record<string, string> = Object.fromEntries(
    columns.map((c) => [c.code, c.color ?? "#64748b"]),
  );

  return { columns, visible, labels, colors };
}
