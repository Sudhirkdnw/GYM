"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import {
  AttendanceFloorSummary,
  Permission,
} from "@gymos/shared-types";
import { Button } from "@/components/ui/button";
import { AttendanceNav } from "@/components/attendance/AttendanceNav";
import { ManualCheckInModal } from "@/components/attendance/ManualCheckInModal";
import { sound } from "@/components/attendance/sound";
import {
  Users,
  QrCode,
  UserPlus,
  RefreshCw,
  Clock,
  LogOut,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Activity,
  ShieldAlert,
  Loader2,
  Building2,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function AttendanceDashboardPage() {
  const router = useRouter();
  const { organization, selectedBranch, isAuthenticated, isLoading: authLoading } = useAuth();

  const [summary, setSummary] = useState<AttendanceFloorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const permissions = organization?.permissions || [];
  const canReadFloor = permissions.includes(Permission.ATTENDANCE_FLOOR_READ);
  const canCheckOut = permissions.includes(Permission.ATTENDANCE_CHECKOUT);
  const canCheckIn = permissions.includes(Permission.ATTENDANCE_CHECKIN) || permissions.includes(Permission.ATTENDANCE_MANUAL);

  const fetchFloorData = useCallback(async (isBackground = false) => {
    if (!selectedBranch?.id) return;
    try {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const res = await apiClient<AttendanceFloorSummary>(
        `/attendance/floor?branchId=${selectedBranch.id}`
      );
      setSummary(res);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError((err as Error).message || "Failed to load live floor summary");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBranch?.id]);

  // Initial load
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (selectedBranch?.id) {
      fetchFloorData();
    }
  }, [authLoading, isAuthenticated, selectedBranch?.id, fetchFloorData, router]);

  // Auto-refresh interval (15 seconds)
  useEffect(() => {
    if (!autoRefresh || !selectedBranch?.id) return;
    const interval = setInterval(() => {
      fetchFloorData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedBranch?.id, fetchFloorData]);

  // Handle Checkout
  const handleCheckout = async (attendanceId: string, memberName: string) => {
    try {
      setCheckingOutId(attendanceId);
      setActionMessage(null);

      await apiClient("/attendance/check-out", {
        method: "POST",
        body: JSON.stringify({ attendanceId }),
      });

      sound.playSuccess();
      setActionMessage({
        type: "success",
        text: `Checked out ${memberName} successfully`,
      });

      // Refresh roster immediately
      await fetchFloorData(true);
    } catch (err: unknown) {
      sound.playError();
      const msg = err instanceof ApiClientError ? err.message : (err as Error).message;
      setActionMessage({
        type: "error",
        text: `Check-out failed: ${msg}`,
      });
    } finally {
      setCheckingOutId(null);
    }
  };

  const getElapsedDuration = (checkInTime: string) => {
    const diffMs = Math.max(0, Date.now() - new Date(checkInTime).getTime());
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  if (authLoading || (loading && !summary)) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-zinc-500 text-sm">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <span>Synchronizing live floor state...</span>
        </div>
      </div>
    );
  }

  if (!canReadFloor) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20">
        <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Access Restricted</h2>
        <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
          Your assigned role does not have permission to view live gym floor occupancy.
        </p>
      </div>
    );
  }

  const activeSessions = summary?.activeSessions || [];
  const filteredSessions = activeSessions.filter((s) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      s.memberName?.toLowerCase().includes(q) ||
      s.memberNumber?.toLowerCase().includes(q) ||
      s.planName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-white/[0.06]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="h-7 w-7 text-violet-600 dark:text-violet-400" />
            <span>Front Desk & Live Floor</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400 flex items-center gap-2">
            <span>Branch:</span>
            <strong className="text-slate-800 dark:text-zinc-200 font-semibold">
              {selectedBranch?.name || "All Branches"}
            </strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canCheckIn && (
            <>
              <Link href="/dashboard/attendance/scanner">
                <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs gap-1.5 shadow-glow shadow-violet-500/25">
                  <QrCode className="h-4 w-4" />
                  <span>Scanner Mode</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                className="text-xs gap-1.5 border-slate-200 dark:border-white/[0.08]"
                onClick={() => setIsManualModalOpen(true)}
              >
                <UserPlus className="h-4 w-4 text-emerald-500" />
                <span>Manual Check-In</span>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchFloorData(true)}
            disabled={refreshing}
            className="text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 text-xs gap-1.5"
            title="Refresh Floor Count"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-violet-500" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Submodule Navigation */}
      <AttendanceNav />

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 p-3.5 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Notification */}
      {actionMessage && (
        <div
          className={`rounded-xl p-3.5 text-xs flex items-center justify-between border ${
            actionMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/80"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800/80"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-semibold underline hover:no-underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Live Headcount */}
        <div className="p-5 rounded-2xl border bg-white border-slate-200 shadow-sm dark:bg-[#131622] dark:border-white/[0.08] dark:shadow-card-dark">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Live Headcount
            </span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {summary?.currentCount ?? 0}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">members on floor</span>
          </div>
        </div>

        {/* Today's Check-ins */}
        <div className="p-5 rounded-2xl border bg-white border-slate-200 shadow-sm dark:bg-[#131622] dark:border-white/[0.08] dark:shadow-card-dark">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Today&apos;s Check-Ins
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/15 text-emerald-600 dark:text-emerald-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {summary?.totalCheckInsToday ?? 0}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">total visits today</span>
          </div>
        </div>

        {/* Peak Occupancy */}
        <div className="p-5 rounded-2xl border bg-white border-slate-200 shadow-sm dark:bg-[#131622] dark:border-white/[0.08] dark:shadow-card-dark">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Peak Floor Today
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/15 text-violet-600 dark:text-violet-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {summary?.peakTodayCount ?? 0}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">peak concurrent</span>
          </div>
        </div>

        {/* Auto-Refresh Control */}
        <div className="p-5 rounded-2xl border bg-white border-slate-200 shadow-sm dark:bg-[#131622] dark:border-white/[0.08] dark:shadow-card-dark flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Live Polling Status
            </span>
            <Clock className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700 dark:text-zinc-300">
              {autoRefresh ? "Polling active (15s)" : "Paused (manual)"}
            </span>
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                autoRefresh
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-500/30"
                  : "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-white/[0.08] dark:text-zinc-300 dark:border-white/[0.1]"
              }`}
            >
              {autoRefresh ? "Active" : "Paused"}
            </button>
          </div>
        </div>
      </div>

      {/* Active Members Roster Table */}
      <div className="rounded-2xl border overflow-hidden bg-white border-slate-200 shadow-sm dark:bg-[#131622] dark:border-white/[0.08] dark:shadow-card-dark">
        {/* Table Header Bar */}
        <div className="p-5 border-b border-slate-100 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Active Members In-Gym
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-500/30">
              {filteredSessions.length} active
            </span>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search active roster..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border transition-all focus:outline-none
                bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-violet-500
                dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-violet-500"
            />
          </div>
        </div>

        {/* Table Content */}
        {filteredSessions.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Gym floor is currently quiet"
            description="No active member workouts recorded right now. Start checking in members using the Front-Desk Scanner or Manual Check-In."
            action={
              canCheckIn
                ? {
                    label: "Launch Scanner",
                    onClick: () => router.push("/dashboard/attendance/scanner"),
                    icon: QrCode,
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 dark:bg-white/[0.03] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-white/[0.08]">
                <tr>
                  <th className="py-3 px-5">Member</th>
                  <th className="py-3 px-5">Plan</th>
                  <th className="py-3 px-5">Check-In Time</th>
                  <th className="py-3 px-5">Elapsed</th>
                  <th className="py-3 px-5">Method</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {filteredSessions.map((session) => (
                  <tr
                    key={session.id}
                    className="hover:bg-slate-50/75 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    {/* Member */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 font-bold text-xs">
                          {session.memberName?.[0] || "M"}
                        </div>
                        <div>
                          <Link
                            href={`/dashboard/members/${session.memberId}`}
                            className="font-bold text-slate-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 transition-colors block"
                          >
                            {session.memberName}
                          </Link>
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                            {session.memberNumber}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="py-3.5 px-5">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-[11px] font-medium text-slate-700 dark:text-zinc-300">
                        {session.planName || "General Admission"}
                      </span>
                    </td>

                    {/* Check-In Time */}
                    <td className="py-3.5 px-5 text-slate-700 dark:text-zinc-300">
                      {new Date(session.checkInTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* Elapsed Duration */}
                    <td className="py-3.5 px-5 font-semibold text-emerald-600 dark:text-emerald-400">
                      {getElapsedDuration(session.checkInTime)}
                    </td>

                    {/* Method */}
                    <td className="py-3.5 px-5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-white/[0.06] dark:text-zinc-300 dark:border-white/[0.1]">
                        {session.method}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-5 text-right">
                      {canCheckOut && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={checkingOutId === session.id}
                          onClick={() => handleCheckout(session.id, session.memberName)}
                          className="text-xs text-slate-600 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 gap-1.5 h-8 px-2.5"
                          title="Check out member"
                        >
                          {checkingOutId === session.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                          ) : (
                            <LogOut className="h-3.5 w-3.5" />
                          )}
                          <span>Check Out</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Check-In Modal */}
      <ManualCheckInModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        branch={selectedBranch}
        onSuccess={() => {
          fetchFloorData(true);
        }}
      />
    </div>
  );
}
