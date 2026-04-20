"use client";

import { Search } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      <div>
        <h1 className="text-[15px] font-semibold text-slate-800 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск..."
            className="h-8 w-52 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
          />
        </div>
      </div>
    </header>
  );
}
