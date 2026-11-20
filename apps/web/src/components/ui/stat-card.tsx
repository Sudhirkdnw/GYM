import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: string;
    isUpward: boolean;
    label?: string;
  };
  subtitle?: string;
  variant?: "purple" | "green" | "amber" | "rose" | "indigo";
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  variant = "purple",
  className,
}: StatCardProps) {
  const iconVariants = {
    purple:
      "bg-violet-600/15 text-violet-600 border-violet-500/20 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30",
    green:
      "bg-emerald-600/15 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
    amber:
      "bg-amber-600/15 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    rose:
      "bg-rose-600/15 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30",
    indigo:
      "bg-indigo-600/15 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
  };

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200",
        "bg-white border-slate-200 shadow-sm hover:shadow-md",
        "dark:bg-[#131622] dark:border-white/[0.08] dark:shadow-card-dark dark:hover:border-white/[0.14]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
            {title}
          </span>
          <span className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </span>
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-sm",
            iconVariants[variant]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-xs">
        {trend && (
          <div
            className={cn(
              "flex items-center gap-0.5 font-semibold",
              trend.isUpward
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            )}
          >
            {trend.isUpward ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            <span>{trend.value}</span>
          </div>
        )}
        {(trend?.label || subtitle) && (
          <span className="text-slate-400 dark:text-zinc-500 truncate">
            {trend?.label || subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
