"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import {
  History,
  ArrowLeft,
  Search,
  Filter,
  Calendar,
  RefreshCw,
  Eye,
  ShieldCheck,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  User,
  Globe,
  Mail,
  MessageSquare,
  FileText,
  X,
} from "lucide-react";

interface AuditLogRecord {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    isSuperAdmin: boolean;
  } | null;
}

interface AuditLogResponse {
  data: AuditLogRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function PlatformAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  // Metadata Diff Modal
  const [activeLog, setActiveLog] = useState<AuditLogRecord | null>(null);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: meta.limit.toString(),
      });

      if (search.trim()) params.append("search", search.trim());
      if (actionFilter !== "ALL") params.append("action", actionFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await apiClient<AuditLogResponse>(`/platform/settings/audit-logs?${params.toString()}`);
      setLogs(res.data);
      setMeta(res.meta);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadLogs();
  };

  const getActionBadge = (action: string) => {
    if (action.includes("BRANDING")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
          <Globe className="w-3 h-3" />
          BRANDING
        </span>
      );
    }
    if (action.includes("SMTP")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          <Mail className="w-3 h-3" />
          SMTP EMAIL
        </span>
      );
    }
    if (action.includes("WHATSAPP")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <MessageSquare className="w-3 h-3" />
          WHATSAPP
        </span>
      );
    }
    if (action.includes("TEMPLATE")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <FileText className="w-3 h-3" />
          TEMPLATE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-zinc-300">
        <ShieldCheck className="w-3 h-3" />
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/[0.08] pb-6">
        <div>
          <Link
            href="/platform/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Settings Hub</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Platform Audit Logs
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Authoritative immutable trail of platform settings changes, verification tests, and Super Admin actions.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadLogs}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#12131a] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-700 dark:text-zinc-200 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by action, actor email, IP..."
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">All Actions</option>
              <option value="PLATFORM_BRANDING_UPDATED">Branding Updated</option>
              <option value="SMTP_CONFIG_UPDATED">SMTP Config Updated</option>
              <option value="SMTP_CONNECTION_TEST">SMTP Test Connection</option>
              <option value="SMTP_SEND_TEST_EMAIL">SMTP Send Test Email</option>
              <option value="WHATSAPP_CONFIG_UPDATED">WhatsApp Config Updated</option>
              <option value="WHATSAPP_CONNECTION_VERIFIED">WhatsApp Verified</option>
              <option value="WHATSAPP_SEND_TEST_MESSAGE">WhatsApp Test Message</option>
              <option value="EMAIL_TEMPLATE_UPDATED">Template Updated</option>
              <option value="EMAIL_TEMPLATE_TEST_SENT">Template Test Sent</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Submit Search */}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-all text-center"
            >
              Filter
            </button>
            {(search || actionFilter !== "ALL" || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setActionFilter("ALL");
                  setStartDate("");
                  setEndDate("");
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-zinc-300 hover:bg-slate-100"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Super Admin Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    {isLoading ? "Loading audit logs..." : "No platform audit logs found."}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-zinc-300 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      {log.user ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 flex items-center justify-center font-bold text-[10px]">
                            {log.user.firstName ? log.user.firstName[0] : "A"}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white leading-tight">
                              {log.user.firstName || "Platform"} {log.user.lastName || "Admin"}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                              {log.user.email}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">System Automation</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                      {log.entity}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                      {log.ipAddress || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setActiveLog(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
          <span>
            Showing {logs.length} of {meta.total} audit events
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.1] hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-xs text-slate-700 dark:text-zinc-300">
              Page {page} of {meta.totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.1] hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Metadata Diff & Security Inspection */}
      {activeLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#12131a] border border-slate-200 dark:border-white/[0.1] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Audit Log Security Details
                </h3>
                <p className="text-[11px] font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                  ID: {activeLog.id}
                </p>
              </div>
              <button
                onClick={() => setActiveLog(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#0b0c12] border border-slate-200 dark:border-white/[0.06]">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Action
                  </span>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {activeLog.action}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Entity
                  </span>
                  <p className="font-mono text-slate-700 dark:text-zinc-300 mt-0.5">
                    {activeLog.entity} ({activeLog.entityId || "N/A"})
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Actor Email
                  </span>
                  <p className="text-slate-700 dark:text-zinc-300 mt-0.5">
                    {activeLog.user?.email || "System"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    IP Address
                  </span>
                  <p className="font-mono text-slate-700 dark:text-zinc-300 mt-0.5">
                    {activeLog.ipAddress || "—"}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Safe Metadata & Change Summary:
                </span>
                <pre className="mt-1 p-3.5 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60 leading-relaxed">
                  {JSON.stringify(activeLog.metadata || {}, null, 2)}
                </pre>
              </div>

              {activeLog.userAgent && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    User Agent
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono break-all mt-0.5">
                    {activeLog.userAgent}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
