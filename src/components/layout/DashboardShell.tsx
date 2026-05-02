"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import Image from "next/image";
import Sidebar from "@/components/layout/Sidebar";
import { Role } from "@prisma/client";

interface Props {
  role: Role;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}

export default function DashboardShell({ role, userName, userEmail, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 lg:static lg:z-auto lg:translate-x-0 transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          role={role}
          userName={userName}
          userEmail={userEmail}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex h-14 items-center gap-3 px-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 lg:hidden shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Открыть меню"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Image src="/logo.svg" alt="Muras" width={28} height={20} className="object-contain" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Muras-Brand</span>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}