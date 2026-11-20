"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import {
  AttendanceRecordData,
  PaginatedResult,
  AttendanceStatus,
  AttendanceMethod,
  Permission,
} from "@gymos/shared-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AttendanceNav } from "@/components/attendance/AttendanceNav";
import {
  History,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  Loader2,
} from "lucide-react";

export default function AttendanceHistoryPage() {
  const router = useRouter();
  const { organization, branches, selectedBranch, isAuthenticated, isLoading: authLoading } = useAuth();

  const [data, setData] = useState<PaginatedResult<AttendanceRecordData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>(selectedBranch?.id || "ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(1);
  const limit = 15;

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const permissions = organization?.permissions || [];
  const canRead = permissions.includes(Permission.ATTENDANCE_READ);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (search.trim()) params.set("search", search.trim());
      if (branchFilter !== "ALL") params.set("branchId", branchFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (methodFilter !== "ALL") params.set("method", methodFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await apiClient<PaginatedResult<AttendanceRecordData>>(
        `/attendance/records?${params.toString()}`
      );
      setData(res);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError((err as Error).message || "Failed to load attendance records");
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, branchFilter, statusFilter, methodFilter, startDate, endDate]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchRecords();
  }, [authLoading, isAuthenticated, fetchRecords, router]);

  // Export to CSV across all matching paginated records
  const handleExportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress({ current: 0, total: 0 });
    setExportNotice(null);

    try {
      const MAX_EXPORT_LIMIT = 5000;
      const batchLimit = 100;
      let currentPage = 1;
      let totalRecords = 0;
      const allRecords: AttendanceRecordData[] = [];

      do {
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("limit", String(batchLimit));

        if (search.trim()) params.set("search", search.trim());
        if (branchFilter !== "ALL") params.set("branchId", branchFilter);
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (methodFilter !== "ALL") params.set("method", methodFilter);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const res = await apiClient<PaginatedResult<AttendanceRecordData>>(
          `/attendance/records?${params.toString()}`
        );

        totalRecords = res.meta.total;
        allRecords.push(...res.items);
        setExportProgress({
          current: allRecords.length,
          total: Math.min(totalRecords, MAX_EXPORT_LIMIT),
        });

        if (res.items.length === 0 || currentPage >= res.meta.totalPages) {
          break;
        }
        currentPage++;
      } while (allRecords.length < totalRecords && allRecords.length < MAX_EXPORT_LIMIT);

      if (allRecords.length === 0) {
        setExportNotice("No attendance records found matching current filters.");
        return;
      }

      if (totalRecords > MAX_EXPORT_LIMIT) {
        setExportNotice(
          `Export capped at ${MAX_EXPORT_LIMIT} records out of ${totalRecords} matching filters to prevent browser memory exhaustion.`
        );
      }

      // Safe CSV value escaper
      const escapeCsv = (val: unknown): string => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const headers = [
        "Record ID",
        "Member Name",
        "Member Number",
        "Branch",
        "Membership Plan",
        "Check-In Time",
        "Check-Out Time",
        "Duration (Minutes)",
        "Attendance Status",
        "Check-In Method",
        "Verified By",
        "Notes",
      ];

      const rows = allRecords.map((r) => [
        escapeCsv(r.id),
        escapeCsv(r.memberName),
        escapeCsv(r.memberNumber),
        escapeCsv(r.branchName || ""),
        escapeCsv(r.planName || ""),
        escapeCsv(new Date(r.checkInTime).toLocaleString("en-IN")),
        escapeCsv(r.checkOutTime ? new Date(r.checkOutTime).toLocaleString("en-IN") : "Active"),
        escapeCsv(r.durationMinutes ?? "-"),
        escapeCsv(r.status),
        escapeCsv(r.method),
        escapeCsv(r.verifiedByName || ""),
        escapeCsv(r.notes || ""),
      ]);

      // UTF-8 BOM prefix (\uFEFF) ensures proper Unicode rendering in Excel and spreadsheets
      const csvContent =
        "\uFEFF" +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\r\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `attendance_export_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setExportNotice(`Export failed: ${err.message}`);
      } else {
        setExportNotice(
          (err as Error).message || "Failed to export attendance records"
        );
      }
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case AttendanceStatus.CHECKED_IN:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            CHECKED IN
          </span>
        );
      case AttendanceStatus.CHECKED_OUT:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            CHECKED OUT
          </span>
        );
      case AttendanceStatus.AUTO_CHECKED_OUT:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            AUTO CHECKOUT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            {status}
          </span>
        );
    }
  };

  if (!canRead) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="rounded-xl border border-red-200 dark:border-red-800/80 bg-red-50/50 dark:bg-red-950/20 p-8 text-center max-w-md mx-auto my-12">
          <ShieldAlert className="h-12 w-12 text-red-600 dark:text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Access Restricted</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            You do not have permission to inspect attendance history ledgers.
          </p>
        </div>
      </div>
    );
  }

  const items = data?.items || [];
  const total = data?.meta?.total || 0;
  const totalPages = data?.meta?.totalPages || 1;

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <History className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Attendance Ledger & History
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Audit-ready log of member check-ins, auto-checkouts, and duration records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExporting || total === 0}
            className="text-xs gap-1.5"
            title="Export all records matching current filters as CSV"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {exportProgress && exportProgress.total > 0
                  ? `Exporting (${exportProgress.current}/${exportProgress.total})...`
                  : "Exporting..."}
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" /> Export Filtered History (CSV)
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchRecords()}
            className="text-xs gap-1"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <AttendanceNav />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {exportNotice && (
        <div className="mb-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button
            onClick={() => setExportNotice(null)}
            className="text-amber-600 hover:text-amber-800 dark:text-amber-300 font-semibold text-[10px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Controls Bar */}
      <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Search Member
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Name or Member ID..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                />
              </div>
            </div>

            {/* Branch Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Branch
              </label>
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
              >
                <option value="ALL">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
              >
                <option value="ALL">All Statuses</option>
                <option value={AttendanceStatus.CHECKED_IN}>Checked In</option>
                <option value={AttendanceStatus.CHECKED_OUT}>Checked Out</option>
                <option value={AttendanceStatus.AUTO_CHECKED_OUT}>Auto Checked Out</option>
              </select>
            </div>

            {/* Method Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Method
              </label>
              <select
                value={methodFilter}
                onChange={(e) => {
                  setMethodFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
              >
                <option value="ALL">All Methods</option>
                <option value={AttendanceMethod.QR_SCAN}>Dynamic QR</option>
                <option value={AttendanceMethod.MANUAL_STAFF}>Manual Staff</option>
                <option value={AttendanceMethod.RFID_CARD}>RFID / Badge</option>
                <option value={AttendanceMethod.KIOSK}>Kiosk</option>
              </select>
            </div>

            {/* Date Range Start */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Date (From)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
              />
            </div>

            {/* Date Range End */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Date (To)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-xs text-zinc-500 dark:text-zinc-400">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-500" />
              Loading attendance records...
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-xs text-zinc-500 dark:text-zinc-400">
              <History className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                No attendance records matched the filter criteria.
              </p>
              <p className="mt-1">Try clearing filters or selecting another date range.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50/75 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-2.5 px-4">Member</th>
                    <th className="py-2.5 px-4">Branch</th>
                    <th className="py-2.5 px-4">Check-In</th>
                    <th className="py-2.5 px-4">Check-Out</th>
                    <th className="py-2.5 px-4">Duration</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Method</th>
                    <th className="py-2.5 px-4">Staff Verified</th>
                    <th className="py-2.5 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {items.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/dashboard/members/${record.memberId}`}
                          className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        >
                          {record.memberName}
                        </Link>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {record.memberNumber} • {record.planName || "General Plan"}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                        {record.branchName || "—"}
                      </td>

                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                        <div>
                          {new Date(record.checkInTime).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {new Date(record.checkInTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                        {record.checkOutTime ? (
                          <>
                            <div>
                              {new Date(record.checkOutTime).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {new Date(record.checkOutTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            In Gym
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-semibold text-zinc-800 dark:text-zinc-200">
                        {record.durationMinutes != null ? `${record.durationMinutes}m` : "—"}
                      </td>

                      <td className="py-3 px-4">{getStatusBadge(record.status)}</td>

                      <td className="py-3 px-4">
                        <span className="text-[10px] uppercase font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                          {record.method}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 text-[11px]">
                        {record.verifiedByName || "System"}
                      </td>

                      <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 text-[11px] max-w-[160px] truncate" title={record.notes || ""}>
                        {record.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {total > limit && (
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <div>
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} records
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="h-7 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="h-7 text-xs"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
