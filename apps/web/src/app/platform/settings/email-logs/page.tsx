"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import {
  Send,
  ArrowLeft,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Mail,
  Trash2,
  ExternalLink,
  RotateCcw,
  Clock,
  Server,
  X,
  FileText,
  Filter,
} from "lucide-react";

interface EmailLogItem {
  id: string;
  recipient: string;
  sender: string;
  subject: string;
  templateCode: string | null;
  status: "SUCCESS" | "FAILED";
  errorMessage: string | null;
  messageId: string | null;
  response: string | null;
  metadata: any;
  sentBy: string | null;
  createdAt: string;
}

interface EmailLogsResponse {
  items: EmailLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

export default function PlatformEmailLogsPage() {
  const [logs, setLogs] = useState<EmailLogItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, success: 0, failed: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SUCCESS" | "FAILED">("ALL");

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<EmailLogItem | null>(null);

  // Resend Loading state
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  // Notification Toast
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchLogs = async (currentPage = page) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", "15");
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await apiClient<EmailLogsResponse>(
        `/platform/settings/email-logs?${params.toString()}`,
      );

      setLogs(res.items || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load email logs",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleResend = async (log: EmailLogItem) => {
    try {
      setResendingId(log.id);
      setNotification(null);

      const res = await apiClient<{ success: boolean; message: string }>(
        `/platform/settings/email-logs/${log.id}/resend`,
        {
          method: "POST",
        },
      );

      setNotification({
        type: "success",
        message: res.message,
      });

      await fetchLogs(page);
      if (selectedLog && selectedLog.id === log.id) {
        setSelectedLog(null);
      }
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to resend email",
      });
    } finally {
      setResendingId(null);
    }
  };

  const handleClearLogs = async () => {
    try {
      setIsClearing(true);
      const res = await apiClient<{ success: boolean; message: string }>(
        "/platform/settings/email-logs",
        {
          method: "DELETE",
        },
      );

      setNotification({
        type: "success",
        message: res.message,
      });

      setShowClearModal(false);
      await fetchLogs(1);
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to clear logs",
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/[0.08] pb-6">
        <div>
          <Link
            href="/platform/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Settings Hub</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Platform Email Delivery Logs
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Audit trail of all transactional emails dispatched via platform SMTP with delivery confirmations and error traces.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/platform/settings/email"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#12131a] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-700 dark:text-zinc-300 transition-colors shadow-sm"
          >
            <Mail className="w-3.5 h-3.5 text-blue-500" />
            <span>SMTP Settings</span>
          </Link>
          <button
            type="button"
            onClick={() => fetchLogs(page)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#12131a] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-700 dark:text-zinc-300 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-500" : ""}`} />
            <span>Refresh</span>
          </button>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Logs</span>
            </button>
          )}
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-2.5 ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Total Dispatched
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {summary.total}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500">
            Platform outgoing transactional emails
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Delivered Successfully
            </span>
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-800 dark:text-emerald-300">
            {summary.success}
          </p>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
            Handshake and recipient accepted by SMTP
          </p>
        </div>

        <div className="rounded-2xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10 p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              Delivery Failures
            </span>
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-800 dark:text-rose-300">
            {summary.failed}
          </p>
          <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
            Authentication rejected or connection timeout
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by recipient email, subject, sender, or error message..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#1a1b26] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </form>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border border-slate-200 dark:border-white/[0.1] p-1 rounded-xl bg-slate-50 dark:bg-[#1a1b26] text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  statusFilter === "ALL"
                    ? "bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All ({summary.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("SUCCESS")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  statusFilter === "SUCCESS"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-slate-500 dark:text-zinc-400 hover:text-emerald-600"
                }`}
              >
                Delivered ({summary.success})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("FAILED")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  statusFilter === "FAILED"
                    ? "bg-rose-500 text-white shadow-sm"
                    : "text-slate-500 dark:text-zinc-400 hover:text-rose-600"
                }`}
              >
                Failed ({summary.failed})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Recipient</th>
                <th className="px-5 py-3.5">Subject & Template</th>
                <th className="px-5 py-3.5">From Address</th>
                <th className="px-5 py-3.5">Dispatched At</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Loading platform email delivery logs...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 dark:text-zinc-500">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-600 dark:text-zinc-400">
                      No email delivery logs found
                    </p>
                    <p className="text-[11px] mt-1">
                      Outgoing emails sent from SMTP settings or template tests will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isSuccess = log.status === "SUCCESS";
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            DELIVERED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            FAILED
                          </span>
                        )}
                      </td>

                      {/* Recipient */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {log.recipient}
                        </span>
                      </td>

                      {/* Subject & Template */}
                      <td className="px-5 py-4 max-w-xs">
                        <p className="font-medium text-slate-900 dark:text-white truncate">
                          {log.subject}
                        </p>
                        {log.templateCode && (
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                            {log.templateCode}
                          </span>
                        )}
                        {!isSuccess && log.errorMessage && (
                          <p className="text-[11px] text-rose-500 truncate mt-0.5 font-mono">
                            {log.errorMessage}
                          </p>
                        )}
                      </td>

                      {/* From */}
                      <td className="px-5 py-4 whitespace-nowrap text-slate-600 dark:text-zinc-400">
                        {log.sender}
                      </td>

                      {/* Dispatched At */}
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 whitespace-nowrap text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.1] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-700 dark:text-zinc-300 font-medium transition-colors"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResend(log)}
                          disabled={resendingId === log.id}
                          className="px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-semibold transition-colors disabled:opacity-50"
                        >
                          <RotateCcw
                            className={`w-3 h-3 inline mr-1 ${
                              resendingId === log.id ? "animate-spin" : ""
                            }`}
                          />
                          <span>{resendingId === log.id ? "Sending..." : "Resend"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-white/[0.08] text-xs">
            <span className="text-slate-500 dark:text-zinc-400">
              Page {page} of {totalPages} ({total} total logs)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const p = Math.max(1, page - 1);
                  setPage(p);
                  fetchLogs(p);
                }}
                disabled={page <= 1 || isLoading}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = Math.min(totalPages, page + 1);
                  setPage(p);
                  fetchLogs(p);
                }}
                disabled={page >= totalPages || isLoading}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#12131a] max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl ${
                    selectedLog.status === "SUCCESS"
                      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600"
                      : "bg-rose-100 dark:bg-rose-950/40 text-rose-600"
                  }`}
                >
                  {selectedLog.status === "SUCCESS" ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Email Delivery Audit Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                    Log ID: {selectedLog.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Delivery Status Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  selectedLog.status === "SUCCESS"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                    : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold uppercase tracking-wider">
                    {selectedLog.status === "SUCCESS" ? "DELIVERY CONFIRMED" : "DELIVERY FAILED"}
                  </span>
                </div>
                <span className="font-mono text-[11px]">
                  {new Date(selectedLog.createdAt).toLocaleString()}
                </span>
              </div>

              {/* Error Message if Failed */}
              {selectedLog.status === "FAILED" && selectedLog.errorMessage && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    SMTP Error Details:
                  </p>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap break-all bg-black/10 dark:bg-black/30 p-2.5 rounded-lg border border-rose-500/20">
                    {selectedLog.errorMessage}
                  </pre>
                  {selectedLog.errorMessage.includes("535") && (
                    <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-2 font-medium">
                      💡 <strong>Gmail Hint:</strong> Google rejected your login credentials. If you are using Gmail, you cannot use your standard password. You must generate an <strong>App Password</strong> in your Google Account Security settings.
                    </p>
                  )}
                </div>
              )}

              {/* Key Value Table */}
              <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] p-4 bg-slate-50/50 dark:bg-[#1a1b26] space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold text-slate-500 dark:text-zinc-400">Recipient:</span>
                  <span className="col-span-2 font-mono font-medium text-slate-900 dark:text-white">
                    {selectedLog.recipient}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold text-slate-500 dark:text-zinc-400">Sender Address:</span>
                  <span className="col-span-2 font-mono text-slate-900 dark:text-white">
                    {selectedLog.sender}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold text-slate-500 dark:text-zinc-400">Subject:</span>
                  <span className="col-span-2 font-medium text-slate-900 dark:text-white">
                    {selectedLog.subject}
                  </span>
                </div>
                {selectedLog.templateCode && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-semibold text-slate-500 dark:text-zinc-400">Template Code:</span>
                    <span className="col-span-2 font-mono text-violet-600 dark:text-violet-400 font-bold">
                      {selectedLog.templateCode}
                    </span>
                  </div>
                )}
                {selectedLog.messageId && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-semibold text-slate-500 dark:text-zinc-400">Message ID:</span>
                    <span className="col-span-2 font-mono text-slate-700 dark:text-zinc-300 break-all">
                      {selectedLog.messageId}
                    </span>
                  </div>
                )}
                {selectedLog.response && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-semibold text-slate-500 dark:text-zinc-400">Server Response:</span>
                    <span className="col-span-2 font-mono text-slate-700 dark:text-zinc-300 break-all">
                      {selectedLog.response}
                    </span>
                  </div>
                )}
              </div>

              {/* Metadata JSON */}
              {selectedLog.metadata && (
                <div className="space-y-1.5">
                  <span className="font-semibold text-slate-600 dark:text-zinc-400">
                    Connection Metadata & Payload Info:
                  </span>
                  <pre className="p-3 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/[0.08] text-[11px] font-mono overflow-x-auto text-slate-800 dark:text-zinc-300">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/[0.1] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-700 dark:text-zinc-300 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleResend(selectedLog)}
                disabled={resendingId === selectedLog.id}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm disabled:opacity-50"
              >
                <RotateCcw
                  className={`w-3.5 h-3.5 ${resendingId === selectedLog.id ? "animate-spin" : ""}`}
                />
                <span>{resendingId === selectedLog.id ? "Dispatching..." : "Resend Email"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Logs Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#12131a] max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950/50">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Clear All Email Logs?
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              Are you sure you want to delete all <strong>{summary.total}</strong> platform email delivery records? All audit history of dispatched emails and delivery error traces will be purged.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/[0.1] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-700 dark:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearLogs}
                disabled={isClearing}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm disabled:opacity-50"
              >
                {isClearing ? "Clearing..." : "Yes, Purge Logs"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
