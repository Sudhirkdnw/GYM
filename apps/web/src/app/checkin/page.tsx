"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { KioskInfoResponse, KioskCheckInResponse } from "@gymos/shared-types";
import {
  Dumbbell,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Phone,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Building2,
  Calendar,
  RotateCcw,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

function CheckInContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || searchParams.get("kioskToken") || "";

  const [kioskInfo, setKioskInfo] = useState<KioskInfoResponse | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Form state
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkInResult, setCheckInResult] = useState<KioskCheckInResponse | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Validate Kiosk Token on mount
  const verifyToken = useCallback(async () => {
    if (!token) {
      setTokenError("Missing attendance QR token. Please scan the QR code displayed at the gym counter.");
      setLoadingInfo(false);
      return;
    }

    try {
      setLoadingInfo(true);
      setTokenError(null);
      const res = await fetch(
        `${API_BASE_URL.replace(/\/$/, "")}/attendance/public/kiosk-info?kioskToken=${encodeURIComponent(token)}`
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Invalid or expired gym desk QR code");
      }
      setKioskInfo(json.data || json);
    } catch (err: unknown) {
      setTokenError((err as Error).message || "Failed to verify attendance QR");
    } finally {
      setLoadingInfo(false);
    }
  }, [token]);

  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  // Handle countdown auto-reset after success
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCheckInResult(null);
      setIdentifier("");
      setCountdown(null);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c ? c - 1 : 0)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Submit check-in
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId) return;

    try {
      setSubmitting(true);
      setCheckInError(null);

      const res = await fetch(
        `${API_BASE_URL.replace(/\/$/, "")}/attendance/public/kiosk-check-in`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kioskToken: token,
            identifier: cleanId,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Attendance check-in rejected");
      }

      const result: KioskCheckInResponse = json.data || json;
      setCheckInResult(result);
      setCountdown(6); // Auto reset in 6 seconds for the next member
    } catch (err: unknown) {
      setCheckInError((err as Error).message || "Failed to mark check-in");
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualReset = () => {
    setCheckInResult(null);
    setCheckInError(null);
    setIdentifier("");
    setCountdown(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 antialiased selection:bg-primary-500/30">
      {/* Top branding */}
      <header className="max-w-md mx-auto w-full pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight tracking-tight text-foreground">
              {kioskInfo?.organizationName || "GymOS"}
            </h1>
            <p className="text-xs text-foreground-muted flex items-center gap-1">
              <Building2 className="w-3 h-3 text-primary-400" />
              {kioskInfo?.branchName || "Check-In Desk"}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-border text-[11px] font-medium text-foreground-muted">
          <Calendar className="w-3 h-3 text-emerald-400" />
          Today: {kioskInfo?.date || new Date().toISOString().slice(0, 10)}
        </div>
      </header>

      {/* Main card */}
      <main className="max-w-md mx-auto w-full my-auto py-6">
        {loadingInfo ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center space-y-4">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto" />
            <p className="text-sm font-medium text-foreground-muted">
              Connecting to gym check-in counter...
            </p>
          </div>
        ) : tokenError ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Invalid QR Code</h2>
            <p className="text-sm text-foreground-muted">{tokenError}</p>
            <button
              onClick={verifyToken}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Scan Again
            </button>
          </div>
        ) : checkInResult ? (
          /* Success Screen */
          <div className="relative rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-surface p-6 sm:p-8 text-center shadow-2xl space-y-6 overflow-hidden">
            <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Check-In Confirmed!
              </span>
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">
                Welcome, {checkInResult.member.firstName} {checkInResult.member.lastName}!
              </h2>
              <p className="text-xs text-foreground-muted">
                {checkInResult.message}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface/80 border border-border text-left space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-foreground-muted">Member ID:</span>
                <span className="font-mono font-semibold text-foreground">
                  {checkInResult.member.memberNumber}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-foreground-muted">Active Plan:</span>
                <span className="font-semibold text-primary-400">
                  {checkInResult.membership.planName}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-foreground-muted">Days Remaining:</span>
                <span className="font-semibold text-foreground">
                  {checkInResult.membership.daysRemaining} Days
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col items-center gap-2">
              <button
                onClick={handleManualReset}
                className="w-full py-2.5 px-4 rounded-xl bg-surface border border-border text-xs font-semibold text-foreground hover:bg-surface-hover transition-colors"
              >
                Next Member Check-In
              </button>
              {countdown !== null && (
                <span className="text-[11px] text-foreground-muted">
                  Auto-resetting for next member in {countdown}s...
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Check-In Form */
          <div className="rounded-2xl border border-border bg-gradient-to-b from-surface to-surface-hover/80 p-6 sm:p-8 shadow-xl backdrop-blur-xl space-y-6">
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-xs font-semibold text-primary-400">
                <Sparkles className="w-3.5 h-3.5" />
                Quick Desk Check-In
              </div>
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">
                Enter Phone Number
              </h2>
              <p className="text-xs text-foreground-muted">
                Enter your registered mobile number or Member ID to mark your attendance.
              </p>
            </div>

            {checkInError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Check-In Denied</p>
                  <p className="text-[11px] leading-relaxed opacity-90">{checkInError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground-muted block">
                  Mobile Number / Member ID
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoFocus
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-border text-foreground font-semibold text-base placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !identifier.trim()}
                className="w-full py-3.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-sm shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating Check-In...
                  </>
                ) : (
                  <>
                    Check In Now
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center">
              <span className="text-[11px] text-foreground-muted flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Verified & encrypted gym attendance system
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-md mx-auto w-full pb-4 text-center text-xs text-foreground-muted/60">
        Powered by GymOS • Automation-First Gym Management
      </footer>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-foreground-muted">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      }
    >
      <CheckInContent />
    </Suspense>
  );
}
