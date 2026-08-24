"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const mouseDownOnOverlay = useRef(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="animate-overlay-in fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        mouseDownOnOverlay.current = e.target === overlayRef.current;
      }}
      onMouseUp={(e) => {
        if (mouseDownOnOverlay.current && e.target === overlayRef.current) onClose();
        mouseDownOnOverlay.current = false;
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-fade-rise flex max-h-[92vh] w-full flex-col overflow-hidden border border-line bg-surface shadow-pop",
          "rounded-t-2xl sm:max-h-[90vh] sm:rounded-2xl",
          sizes[size]
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-1 -mt-0.5 rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <X size={17} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line-soft bg-surface-sunken px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
