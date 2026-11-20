"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import {
  AttendanceSettingsData,
  AttendanceSettingsUpdate,
  Permission,
} from "@gymos/shared-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AttendanceNav } from "@/components/attendance/AttendanceNav";
import {
  Sliders,
  Clock,
  Shield,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  ShieldAlert,
  Loader2,
} from "lucide-react";

export default function AttendanceSettingsPage() {
  const router = useRouter();
  const { organization, branches, isAuthenticated, isLoading: authLoading } = useAuth();

  const [targetBranchId, setTargetBranchId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(10);
  const [autoCheckOutHours, setAutoCheckOutHours] = useState<number>(3);
  const [operatingHoursStart, setOperatingHoursStart] = useState<string>("05:00");
  const [operatingHoursEnd, setOperatingHoursEnd] = useState<string>("23:00");
  const [allowOffHoursCheckIn, setAllowOffHoursCheckIn] = useState<boolean>(false);
  const [allowCheckInWithDues, setAllowCheckInWithDues] = useState<boolean>(false);
  const [maxOverdueGraceDays, setMaxOverdueGraceDays] = useState<number>(0);
  const [requireCheckOut, setRequireCheckOut] = useState<boolean>(false);

  const permissions = organization?.permissions || [];
  const canManage = permissions.includes(Permission.ATTENDANCE_SETTINGS_MANAGE);

  const fetchSettings = useCallback(async (branchId?: string) => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      const query = branchId ? `?branchId=${branchId}` : "";
      const res = await apiClient<AttendanceSettingsData>(`/attendance/settings${query}`);

      // Populate form
      setCooldownMinutes(res.cooldownMinutes ?? 10);
      setAutoCheckOutHours(res.autoCheckOutHours ?? 3);
      setOperatingHoursStart(res.operatingHoursStart || "05:00");
      setOperatingHoursEnd(res.operatingHoursEnd || "23:00");
      setAllowOffHoursCheckIn(res.allowOffHoursCheckIn ?? false);
      setAllowCheckInWithDues(res.allowCheckInWithDues ?? false);
      setMaxOverdueGraceDays(res.maxOverdueGraceDays ?? 0);
      setRequireCheckOut(res.requireCheckOut ?? false);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError((err as Error).message || "Failed to load attendance settings");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchSettings(targetBranchId || undefined);
  }, [authLoading, isAuthenticated, targetBranchId, fetchSettings, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const payload: AttendanceSettingsUpdate = {
        branchId: targetBranchId ? targetBranchId : undefined,
        cooldownMinutes: Number(cooldownMinutes),
        autoCheckOutHours: Number(autoCheckOutHours),
        operatingHoursStart,
        operatingHoursEnd,
        allowOffHoursCheckIn,
        allowCheckInWithDues,
        maxOverdueGraceDays: Number(maxOverdueGraceDays),
        requireCheckOut,
      };

      await apiClient<AttendanceSettingsData>("/attendance/settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setSuccessMessage(
        targetBranchId
          ? "Branch-specific attendance policy saved successfully."
          : "Organization default attendance policy saved successfully."
      );
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError((err as Error).message || "Failed to save attendance settings");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="rounded-xl border border-red-200 dark:border-red-800/80 bg-red-50/50 dark:bg-red-950/20 p-8 text-center max-w-md mx-auto my-12">
          <ShieldAlert className="h-12 w-12 text-red-600 dark:text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Permission Restricted</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            Only Gym Owners and Administrators have permission to modify attendance policies and operating hours.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Sliders className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Attendance Policy Settings
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Configure front-desk operating hours, anti-passback cooldowns, and overdue dues admission rules.
          </p>
        </div>
      </div>

      <AttendanceNav />

      {/* Scope Selector: Organization Default vs Branch Override */}
      <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm mb-6">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
              Policy Configuration Scope
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Select whether you are setting organization-wide defaults or overriding policies for a specific branch.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={targetBranchId}
              onChange={(e) => setTargetBranchId(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Organization Defaults (All Branches)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  Branch: {b.name}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchSettings(targetBranchId || undefined)}
              className="text-xs h-8"
              title="Reload settings"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      {successMessage && (
        <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Operating Hours & Auto-Checkout */}
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <CardTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              Operating Hours & Auto-Checkout Routine
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              Define daily operating windows and max workout durations.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Daily Opening Time (24h format)
                </label>
                <input
                  type="time"
                  value={operatingHoursStart}
                  onChange={(e) => setOperatingHoursStart(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Daily Closing Time (24h format)
                </label>
                <input
                  type="time"
                  value={operatingHoursEnd}
                  onChange={(e) => setOperatingHoursEnd(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Auto-Checkout Duration Limit (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={autoCheckOutHours}
                  onChange={(e) => setAutoCheckOutHours(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
                  required
                />
                <span className="text-[10px] text-zinc-500 mt-0.5 block">
                  Background worker automatically checks out open sessions exceeding this threshold.
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
                <div>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">
                    Allow Off-Hours Check-In
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    If disabled, check-ins outside opening hours are automatically rejected.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={allowOffHoursCheckIn}
                  onChange={(e) => setAllowOffHoursCheckIn(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Security & Anti-Passback */}
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <CardTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              Anti-Passback & Security Controls
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              Prevent badge sharing and enforce mandatory checkout policies.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Anti-Passback Cooldown Window (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={cooldownMinutes}
                  onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
                  required
                />
                <span className="text-[10px] text-zinc-500 mt-0.5 block">
                  Prevents a second check-in by the same member within this window (0 to disable).
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
                <div>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">
                    Require Mandatory Check-Out
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    Requires checkout of active session before checking in again.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={requireCheckOut}
                  onChange={(e) => setRequireCheckOut(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Financial & Overdue Dues Policy */}
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <CardTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              Financial & Overdue Dues Admission Policy
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              Automated admission rules for members with past-due unpaid invoices.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
                <div>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">
                    Allow Check-In with Overdue Dues
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    If disabled, any overdue invoice immediately hard-blocks gym admission.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={allowCheckInWithDues}
                  onChange={(e) => setAllowCheckInWithDues(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Overdue Grace Period (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={maxOverdueGraceDays}
                  disabled={!allowCheckInWithDues}
                  onChange={(e) => setMaxOverdueGraceDays(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs disabled:opacity-50"
                />
                <span className="text-[10px] text-zinc-500 mt-0.5 block">
                  Members with overdue invoices within grace period are admitted with an amber warning banner.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 px-6 shadow-sm"
          >
            {isSaving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving Policies...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Save className="h-3.5 w-3.5" /> Save Attendance Policies
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
