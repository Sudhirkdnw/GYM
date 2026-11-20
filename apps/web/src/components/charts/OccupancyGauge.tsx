import React from "react";
import { Users, Building2 } from "lucide-react";

interface OccupancyGaugeProps {
  currentCount: number;
  maxCapacity?: number;
  branchName?: string;
}

export function OccupancyGauge({
  currentCount,
  maxCapacity = 120,
  branchName = "Main Branch",
}: OccupancyGaugeProps) {
  const percentage = Math.min(
    Math.round((currentCount / (maxCapacity || 1)) * 100),
    100
  );

  const radius = 64;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col h-full justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600/15 text-violet-600 dark:text-violet-400">
            <Users className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
            Live Floor
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>In Gym Now</span>
        </div>
      </div>

      {/* Middle Gauge & Metrics */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">
        {/* Circular Donut Ring */}
        <div className="relative flex items-center justify-center">
          <svg
            height={radius * 2}
            width={radius * 2}
            className="transform -rotate-90"
          >
            {/* Background Track */}
            <circle
              stroke="currentColor"
              fill="transparent"
              strokeWidth={strokeWidth}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              className="text-slate-100 dark:text-white/[0.06]"
            />
            {/* Value Progress Stroke */}
            <circle
              stroke="url(#occupancyGradient)"
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference + " " + circumference}
              style={{ strokeDashoffset }}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              className="transition-all duration-700 ease-out"
            />
            <defs>
              <linearGradient
                id="occupancyGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>

          {/* Centered Number */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <Users className="h-4 w-4 text-violet-500 mb-0.5" />
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
              {currentCount}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium mt-1">
              Members Inside
            </span>
          </div>
        </div>

        {/* Capacity Details */}
        <div className="flex flex-col space-y-3 min-w-[140px]">
          <div className="flex items-center gap-2 text-xs">
            <Building2 className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
            <span className="text-slate-600 dark:text-zinc-300 font-medium truncate">
              {branchName}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 dark:text-zinc-500">
              Current Capacity
            </span>
            <span className="font-semibold text-slate-800 dark:text-zinc-200">
              {maxCapacity}
            </span>
          </div>

          {/* Linear Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-zinc-400">
              <span>Occupancy</span>
              <span className="font-bold text-violet-600 dark:text-violet-400">
                {percentage}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
