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
  brand: { name: string; tagline: string; logo: string };
  children: React.ReactNode;
}

export default function DashboardShell({ role, userName, userEmail, brand, children }: Props) {
  // Sidebar закрывает меню сам при клике по любому пункту (onClose).
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas print:block print:h-auto print:overflow-visible print:bg-white">
      {mobileOpen && (
        <div
          className="animate-overlay-in fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-out print:hidden lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 shadow-pop" : "-translate-x-full"
        }`}
      >
        <Sidebar
          role={role}
          userName={userName}
          userEmail={userEmail}
          brand={brand}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible">
        {/* Мобильная шапка */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 print:hidden lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
            aria-label="Открыть меню"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface">
            <Image
              src={brand.logo}
              alt={brand.name}
              width={18}
              height={18}
              className="h-[18px] w-[18px] object-contain"
              unoptimized
            />
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-fg">{brand.name}</span>
        </div>

        <main className="flex-1 overflow-y-auto print:overflow-visible">{children}</main>
      </div>
    </div>
  );
}
