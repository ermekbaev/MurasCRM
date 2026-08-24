"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
  loading?: boolean;
}

export default function Pagination({ page, pages, total, limit, onPage, loading }: PaginationProps) {
  if (pages <= 1 && total <= limit) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const btn =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-fg-muted " +
    "transition-colors hover:bg-surface-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="flex items-center justify-between gap-3 px-1 py-2">
      <span className="text-xs text-fg-subtle tabular-nums">
        {from}–{to} из {total}
      </span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1 || loading} className={btn} aria-label="Назад">
          <ChevronLeft size={15} />
        </button>
        <span className="px-1 text-xs font-medium text-fg-muted tabular-nums">
          {page} <span className="text-fg-subtle">/</span> {pages}
        </span>
        <button onClick={() => onPage(page + 1)} disabled={page >= pages || loading} className={btn} aria-label="Вперёд">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
