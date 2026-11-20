"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: "pill" | "line";
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  className,
  variant = "pill",
}: TabsProps) {
  if (variant === "line") {
    return (
      <div
        className={cn(
          "flex items-center space-x-1 border-b border-slate-200 dark:border-white/[0.08]",
          className
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all -mb-[1px]",
                isActive
                  ? "border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                    isActive
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                      : "bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-zinc-400"
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex p-1 rounded-xl border bg-slate-100/80 border-slate-200/80 dark:bg-white/[0.04] dark:border-white/[0.08]",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              isActive
                ? "bg-white text-slate-900 shadow-sm dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:text-white dark:shadow-glow dark:shadow-violet-500/25"
                : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                  isActive
                    ? "bg-violet-100 text-violet-700 dark:bg-white/20 dark:text-white"
                    : "bg-slate-200 text-slate-600 dark:bg-white/[0.08] dark:text-zinc-400"
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
