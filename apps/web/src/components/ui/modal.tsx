"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = "lg",
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in-50"
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        ref={modalRef}
        className={cn(
          "relative w-full rounded-2xl border shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-200",
          "bg-white border-slate-200 text-slate-900",
          "dark:bg-[#131622] dark:border-white/[0.1] dark:text-zinc-100",
          maxWidthClasses[maxWidth],
          className
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-white/[0.08]">
            <div>
              {title && (
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {title}
                </h3>
              )}
              {description && (
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.08] transition-colors"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
