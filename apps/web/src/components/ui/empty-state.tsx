import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ className?: string }>;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-dashed",
        "border-slate-200 dark:border-white/[0.1] bg-slate-50/50 dark:bg-white/[0.02]",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400 mb-4 shadow-sm">
        <Icon className="h-7 w-7" />
      </div>
      <h4 className="text-base font-bold text-slate-800 dark:text-zinc-200">
        {title}
      </h4>
      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400 max-w-sm">
        {description}
      </p>
      {action && (
        <div className="mt-5">
          <Button
            size="sm"
            onClick={action.onClick}
            className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-sm"
          >
            {action.icon && <action.icon className="h-4 w-4" />}
            <span>{action.label}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
