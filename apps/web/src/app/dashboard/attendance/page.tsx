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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";

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

      await apiClient(`/attendance/${attendanceId}/checkout`, {
        method: "POST",
      });

      sound.playSuccess();
      setActionMessage({
        type: "success",
        text: `Checked out ${memberName} successfully.`,
      });
      await fetchFloorData(true);
    } catch (err: unknown) {
      sound.playRejection();
      setActionMessage({
        type: "error",
        text: (err as Error).message || "Check-out failed",
      });
    } finally {
      setCheckingOutId(null);
    }
  };

  // Elapsed duration calculator
  const getElapsedDuration = (checkInTimeStr: string): string => {
    const checkIn = new Date(checkInTimeStr).getTime();
    const now = Date.now();
    const diffMinutes = Math.max(0, Math.floor((now - checkIn) / 60000));
    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    }
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (authLoading || (!summary && loading)) {
    return (
      <div className="container mx-auto p-6 max-w-7xl animate-pulse">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
          ))}
        </div>
        <div className="h-96 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
      </div>
    );
  }

  if (!canReadFloor) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="rounded-xl border border-red-200 dark:border-red-800/80 bg-red-50/50 dark:bg-red-950/20 p-8 text-center max-w-md mx-auto my-12">
          <ShieldAlert className="h-12 w-12 text-red-600 dark:text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Access Restricted</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            Your assigned role does not have permission to view live gym floor occupancy.
          </p>
        </div>
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
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Attendance & Front Desk
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Branch: <strong className="text-zinc-800 dark:text-zinc-200">{selectedBranch?.name || "All Branches"}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canCheckIn && (
            <>
              <Link href="/dashboard/attendance/scanner">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-sm">
                  <QrCode className="h-4 w-4" /> Scanner Mode
                </Button>
              </Link>
              <Button
                variant="outline"
                className="text-xs gap-1.5"
                onClick={() => setIsManualModalOpen(true)}
              >
                <UserPlus className="h-4 w-4" /> Manual Check-In
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchFloorData(true)}
            disabled={refreshing}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs gap-1"
            title="Refresh Floor Count"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <AttendanceNav />

      {/* Error Notification */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Notification Message */}
      {actionMessage && (
        <div
          className={`mb-4 rounded-lg p-3 text-xs flex items-center justify-between border ${
            actionMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs underline hover:no-underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Live Headcount
              </span>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                {summary?.currentCount ?? 0}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">members on floor</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Today&apos;s Check-Ins
              </span>
              <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                {summary?.totalCheckInsToday ?? 0}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">total visits today</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Peak Occupancy Today
              </span>
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                {summary?.peakTodayCount ?? 0}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">peak concurrent</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Auto-Refresh Status
              </span>
              <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-zinc-700 dark:text-zinc-300">
                {autoRefresh ? "Polling active (15s)" : "Manual mode"}
              </span>
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`text-[11px] font-bold px-2 py-0.5 rounded transition-colors ${
                  autoRefresh
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {autoRefresh ? "Enabled" : "Paused"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Floor Active Roster Table */}
      <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Active Members In-Gym</span>
              <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                ({filteredSessions.length} active)
              </span>
            </CardTitle>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter roster..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredSessions.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                Gym floor is currently quiet
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                No active member workouts recorded right now. Start checking in members using the Front-Desk Scanner or Manual Check-In.
              </p>
              {canCheckIn && (
                <div className="mt-4 flex justify-center gap-2">
                  <Link href="/dashboard/attendance/scanner">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5">
                      <QrCode className="h-3.5 w-3.5" /> Launch Scanner
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => setIsManualModalOpen(true)}
                  >
                    Manual Check-In
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50/75 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-2.5 px-4">Member</th>
                    <th className="py-2.5 px-4">Plan</th>
                    <th className="py-2.5 px-4">Check-In Time</th>
                    <th className="py-2.5 px-4">Elapsed</th>
                    <th className="py-2.5 px-4">Method</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredSessions.map((session) => (
                    <tr
                      key={session.id}
                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/dashboard/members/${session.memberId}`}
                          className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors block"
                        >
                          {session.memberName}
                        </Link>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {session.memberNumber}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                          {session.planName || "General Admission"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                        {new Date(session.checkInTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                        {getElapsedDuration(session.checkInTime)}
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {session.method}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {canCheckOut && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={checkingOutId === session.id}
                            onClick={() => handleCheckout(session.id, session.memberName)}
                            className="text-xs text-zinc-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 gap-1 h-7 px-2"
                            title="Check out member"
                          >
                            {checkingOutId === session.id ? (
                              <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                            ) : (
                              <LogOut className="h-3 w-3" />
                            )}
                            Check Out
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
