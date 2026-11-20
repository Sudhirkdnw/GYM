import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "primary"
    | "success"
    | "warning"
    | "destructive"
    | "info"
    | "outline";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  ...props
}: BadgeProps) {
  const variantStyles = {
    default:
      "bg-slate-100 text-slate-800 border-slate-200 dark:bg-white/[0.08] dark:text-zinc-200 dark:border-white/[0.1]",
    secondary:
      "bg-slate-200 text-slate-700 border-slate-300 dark:bg-white/[0.05] dark:text-zinc-400 dark:border-white/[0.08]",
    primary:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-500/30",
    success:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-500/30",
    warning:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-500/30",
    destructive:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-500/30",
    info:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-500/30",
    outline:
      "bg-transparent text-slate-700 border-slate-300 dark:text-zinc-300 dark:border-white/[0.15]",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold border transition-colors",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    />
  );
}
