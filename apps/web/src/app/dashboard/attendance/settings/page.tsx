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
  Building2,
  Info,
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
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center max-w-md mx-auto my-12">
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-foreground">Permission Restricted</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Only Gym Owners and Administrators have permission to modify attendance policies and operating hours.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sliders className="h-6 w-6 text-primary" />
              Attendance Policy Settings
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Access Rules
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Configure front-desk operating hours, anti-passback cooldowns, and overdue dues admission rules.
          </p>
        </div>
      </div>

      <AttendanceNav />

      {/* Scope Selector: Organization Default vs Branch Override */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground">
                Policy Configuration Scope
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Select whether you are setting organization-wide defaults or overriding policies for a specific branch.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <select
              value={targetBranchId}
              onChange={(e) => setTargetBranchId(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-border bg-background/50 text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              <option value="">Organization Defaults (All Branches)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  Branch: {b.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => fetchSettings(targetBranchId || undefined)}
              className="p-2 rounded-xl border border-border bg-card hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
              title="Reload settings"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-500 flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-500 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Operating Hours & Auto-Checkout */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Operating Hours & Auto-Checkout Routine
              </h3>
              <p className="text-xs text-muted-foreground">
                Define daily gym access windows and maximum auto-checkout session duration.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Daily Opening Time (24h format)
              </label>
              <input
                type="time"
                value={operatingHoursStart}
                onChange={(e) => setOperatingHoursStart(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Daily Closing Time (24h format)
              </label>
              <input
                type="time"
                value={operatingHoursEnd}
                onChange={(e) => setOperatingHoursEnd(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Auto-Checkout Duration Limit (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="24"
                value={autoCheckOutHours}
                onChange={(e) => setAutoCheckOutHours(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                required
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Background distributed lock worker automatically checks out open sessions exceeding this threshold.
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-muted/20">
              <div className="pr-4">
                <span className="text-xs font-semibold text-foreground block">
                  Allow Off-Hours Check-In
                </span>
                <span className="text-[11px] text-muted-foreground">
                  If disabled, check-ins outside opening hours are automatically rejected.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={allowOffHoursCheckIn}
                  onChange={(e) => setAllowOffHoursCheckIn(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Section 2: Security & Anti-Passback */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Anti-Passback & Security Controls
              </h3>
              <p className="text-xs text-muted-foreground">
                Prevent credential sharing and enforce mandatory checkout policies.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Anti-Passback Cooldown Window (Minutes)
              </label>
              <input
                type="number"
                min="0"
                max="120"
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                required
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Prevents a second check-in by the same member within this window (0 to disable).
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-muted/20">
              <div className="pr-4">
                <span className="text-xs font-semibold text-foreground block">
                  Require Mandatory Check-Out Reminder
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Displays checkout prompts for active sessions during receptionist desk workflows.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={requireCheckOut}
                  onChange={(e) => setRequireCheckOut(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Section 3: Financial & Overdue Dues Policy */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Financial & Overdue Dues Admission Policy
              </h3>
              <p className="text-xs text-muted-foreground">
                Automated gatekeeping rules for members with past-due unpaid invoices.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-muted/20">
              <div className="pr-4">
                <span className="text-xs font-semibold text-foreground block">
                  Allow Check-In with Overdue Dues
                </span>
                <span className="text-[11px] text-muted-foreground">
                  If disabled, any overdue invoice immediately hard-blocks gym admission.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={allowCheckInWithDues}
                  onChange={(e) => setAllowCheckInWithDues(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Overdue Grace Period (Days)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                value={maxOverdueGraceDays}
                disabled={!allowCheckInWithDues}
                onChange={(e) => setMaxOverdueGraceDays(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono disabled:opacity-40"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Members with overdue invoices within grace period are admitted with an amber dues warning.
              </span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving Policies...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Attendance Policies
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
