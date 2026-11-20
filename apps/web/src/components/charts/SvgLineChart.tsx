"use client";

import React, { useState } from "react";

export interface DataPoint {
  label: string; // e.g. "Jan 21"
  value: number; // e.g. 120
}

interface SvgLineChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  unit?: string;
}

export function SvgLineChart({
  data,
  height = 180,
  color = "#8b5cf6",
  unit = "check-ins",
}: SvgLineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-slate-400 dark:text-zinc-500">
        No trend data available
      </div>
    );
  }

  const paddingLeft = 35;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;
  const viewBoxWidth = 500;
  const viewBoxHeight = height;

  const chartWidth = viewBoxWidth - paddingLeft - paddingRight;
  const chartHeight = viewBoxHeight - paddingTop - paddingBottom;

  const maxValue = Math.max(...data.map((d) => d.value), 10);
  const roundedMax = Math.ceil(maxValue / 50) * 50;

  // Compute point coordinates
  const points = data.map((d, index) => {
    const x =
      paddingLeft + (index / (data.length - 1 || 1)) * chartWidth;
    const y =
      paddingTop + chartHeight - (d.value / roundedMax) * chartHeight;
    return { x, y, ...d };
  });

  // Build SVG bezier path string
  const createCurvedPath = () => {
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const controlX = (current.x + next.x) / 2;
      d += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }
    return d;
  };

  const linePath = createCurvedPath();
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    paddingTop + chartHeight
  } L ${points[0].x} ${paddingTop + chartHeight} Z`;

  return (
    <div className="relative w-full overflow-hidden select-none">
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-auto overflow-visible"
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Horizontal Grid lines */}
        {[0, 0.5, 1].map((pct, i) => {
          const y = paddingTop + chartHeight * (1 - pct);
          const gridVal = Math.round(roundedMax * pct);
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={viewBoxWidth - paddingRight}
                y2={y}
                stroke="currentColor"
                className="text-slate-200 dark:text-white/[0.06]"
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                textAnchor="end"
                className="text-[9px] fill-slate-400 dark:fill-zinc-500 font-mono"
              >
                {gridVal}
              </text>
            </g>
          );
        })}

        {/* Gradient Area Fill */}
        <path d={areaPath} fill="url(#areaGradient)" />

        {/* Curve Stroke Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive Data Points */}
        {points.map((p, i) => {
          const isHovered = hoveredIndex === i;
          return (
            <g key={i} className="cursor-pointer">
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 6 : 4}
                fill={isHovered ? "#ffffff" : color}
                stroke={color}
                strokeWidth={isHovered ? 3 : 2}
                className="transition-all duration-150"
              />
              {/* Invisible larger hover hit area */}
              <circle
                cx={p.x}
                cy={p.y}
                r={16}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />

              {/* X-Axis Day Labels */}
              <text
                x={p.x}
                y={viewBoxHeight - 8}
                textAnchor="middle"
                className={`text-[10px] font-medium transition-colors ${
                  isHovered
                    ? "fill-violet-600 dark:fill-violet-400 font-bold"
                    : "fill-slate-400 dark:fill-zinc-500"
                }`}
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-full pointer-events-none px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-xl border animate-in fade-in-50
            bg-slate-900 text-white border-slate-800
            dark:bg-violet-950 dark:text-violet-100 dark:border-violet-500/40"
          style={{
            left: `${(points[hoveredIndex].x / viewBoxWidth) * 100}%`,
            top: `${(points[hoveredIndex].y / viewBoxHeight) * 100}%`,
            marginTop: "-8px",
          }}
        >
          {points[hoveredIndex].value} {unit}
        </div>
      )}
    </div>
  );
}
