"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  page?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyMessage = "No records found.",
  page = 1,
  totalPages = 1,
  totalItems,
  onPageChange,
  className,
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border overflow-hidden transition-all",
        "bg-white border-slate-200 shadow-sm",
        "dark:bg-[#131622] dark:border-white/[0.08] dark:shadow-card-dark",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          {/* Header */}
          <thead className="border-b bg-slate-50/75 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08]">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={cn(
                    "px-4 py-3.5 font-bold uppercase tracking-wider text-[10px] text-slate-500 dark:text-zinc-400",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {loading ? (
              // Loading Skeleton Rows
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((_, cIdx) => (
                    <td key={cIdx} className="px-4 py-4">
                      <div className="h-4 w-24 rounded bg-slate-200 dark:bg-white/[0.08]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty State Row
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-xs text-slate-400 dark:text-zinc-500 font-medium"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              // Data Rows
              data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  className="hover:bg-slate-50/75 dark:hover:bg-white/[0.03] transition-colors"
                >
                  {columns.map((col, cIdx) => (
                    <td
                      key={cIdx}
                      className={cn(
                        "px-4 py-3.5 text-slate-700 dark:text-zinc-300",
                        col.className
                      )}
                    >
                      {col.cell
                        ? col.cell(row)
                        : col.accessorKey
                        ? String(row[col.accessorKey] ?? "")
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {(totalPages > 1 || totalItems !== undefined) && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-white/[0.08] text-xs text-slate-500 dark:text-zinc-400">
          <div>
            {totalItems !== undefined && (
              <span>
                Total <strong className="text-slate-800 dark:text-zinc-200">{totalItems}</strong> items
              </span>
            )}
          </div>

          {onPageChange && (
            <div className="flex items-center gap-2">
              <span className="text-[11px]">
                Page {page} of {totalPages || 1}
              </span>
              <button
                disabled={page <= 1 || loading}
                onClick={() => onPageChange(page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => onPageChange(page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
