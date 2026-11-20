"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import {
  PublicPassResponse,
  DynamicPassTokenResponse,
  PassStatus,
} from "@gymos/shared-types";
import {
  Dumbbell,
  Clock,
  RefreshCw,
  AlertCircle,
  XCircle,
  Shield,
  Loader2,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function PublicWebPassPage() {
  const params = useParams();
  const passToken = params.passToken as string;

  const [passData, setPassData] = useState<PublicPassResponse | null>(null);
  const [dynamicToken, setDynamicToken] = useState<DynamicPassTokenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(90);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initial fetch of public pass
  const fetchPass = useCallback(async () => {
    if (!passToken) return;
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${API_BASE_URL.replace(/\/$/, "")}/attendance/public/pass/${encodeURIComponent(passToken)}`,
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Invalid or expired access pass link");
      }

      const data: PublicPassResponse = json.data || json;
      setPassData(data);
      setDynamicToken(data.dynamicToken);
      setSecondsRemaining(data.dynamicToken?.refreshIntervalSeconds ? data.dynamicToken.refreshIntervalSeconds * 2 : 90);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load mobile pass");
    } finally {
      setLoading(false);
    }
  }, [passToken]);

  // Refresh dynamic token before expiration
  const refreshToken = useCallback(async () => {
    if (!passToken) return;
    try {
      setRefreshing(true);
      const res = await fetch(
        `${API_BASE_URL.replace(/\/$/, "")}/attendance/public/pass/${encodeURIComponent(passToken)}/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Failed to refresh dynamic pass token");
      }

      const tokenData: { dynamicToken: DynamicPassTokenResponse } = json.data || json;
      setDynamicToken(tokenData.dynamicToken);
      setSecondsRemaining(tokenData.dynamicToken.refreshIntervalSeconds ? tokenData.dynamicToken.refreshIntervalSeconds * 2 : 90);
    } catch {
      // Suppress transient background refresh errors if pass is still valid
    } finally {
      setRefreshing(false);
    }
  }, [passToken]);

  // Initial load
  useEffect(() => {
    fetchPass();
  }, [fetchPass]);

  // Render QR Code onto canvas whenever dynamicToken changes
  useEffect(() => {
    if (dynamicToken?.token && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, dynamicToken.token, {
        width: 250,
        margin: 1,
        color: {
          dark: "#09090b",
          light: "#ffffff",
        },
      }).catch(() => {});
    }
  }, [dynamicToken]);

  // Countdown timer & auto-refresh
  useEffect(() => {
    if (!dynamicToken) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        // Auto-refresh when 45 seconds remain
        if (prev === 45) {
          refreshToken();
        }
        if (prev <= 1) {
          refreshToken();
          return 90;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [dynamicToken, refreshToken]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 to-zinc-200 dark:from-zinc-950 dark:to-zinc-900 flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-sm">
        {/* Pass Card Container */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl overflow-hidden transition-all">
          {/* Header Bar */}
          <div className="bg-zinc-950 text-white p-5 text-center relative">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Dumbbell className="h-5 w-5 text-emerald-400" />
              <span className="font-extrabold tracking-tight text-base">
                {passData?.member?.firstName
                  ? `${passData.member.firstName}'s Pass`
                  : "GymOS Digital Pass"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 uppercase tracking-widest font-semibold">
              Digital Member Pass
            </p>
          </div>

          {/* Main Card Content */}
          <div className="p-6 text-center">
            {loading ? (
              <div className="py-16 space-y-3">
                <Loader2 className="h-10 w-10 text-emerald-600 animate-spin mx-auto" />
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Loading secure member credentials...
                </p>
              </div>
            ) : error ? (
              <div className="py-12 space-y-3">
                <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
                  <XCircle className="h-8 w-8" />
                </div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Pass Unavailable
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                  {error}
                </p>
                <div className="pt-2">
                  <button
                    onClick={fetchPass}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </button>
                </div>
              </div>
            ) : passData?.pass?.status === PassStatus.REVOKED ? (
              <div className="py-12 space-y-3">
                <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <h2 className="text-base font-bold text-red-600 dark:text-red-400">
                  Pass Revoked
                </h2>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                  This access pass has been revoked by front-desk staff. Please visit the reception desk to reactivate your credentials.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Member Profile Banner */}
                <div>
                  <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {passData?.member.firstName}
                  </h1>
                  <span className="text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400">
                    ID: {passData?.member.memberNumber}
                  </span>
                </div>

                {/* QR Code Canvas Box */}
                <div className="relative mx-auto w-64 h-64 bg-white p-3 rounded-2xl border-2 border-zinc-200/90 shadow-inner flex items-center justify-center">
                  <canvas ref={canvasRef} className="rounded-lg" />
                  {refreshing && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-xs rounded-2xl flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                    </div>
                  )}
                </div>

                {/* Security Status Badge & Rolling Countdown */}
                <div className="flex flex-col items-center gap-1.5 pt-1">
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                    <Shield className="h-3 w-3" />
                    <span>Dynamic Rolling Token</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    <Clock className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                    <span>Auto-refreshes in {secondsRemaining}s</span>
                    <button
                      onClick={refreshToken}
                      disabled={refreshing}
                      className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors ml-1"
                      title="Refresh token now"
                    >
                      <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  Hold this QR code directly in front of the gym tablet or laptop camera at the front desk.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-4 text-center text-[11px] text-zinc-400 dark:text-zinc-600 flex items-center justify-center gap-1">
          <Shield className="h-3 w-3" />
          <span>GymOS Secure Mobile Pass • Replay-Protected</span>
        </div>
      </div>
    </div>
  );
}
