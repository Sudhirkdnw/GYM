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
  Sparkles,
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
      setSecondsRemaining(
        data.dynamicToken?.refreshIntervalSeconds
          ? data.dynamicToken.refreshIntervalSeconds * 2
          : 90
      );
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
      setSecondsRemaining(
        tokenData.dynamicToken.refreshIntervalSeconds
          ? tokenData.dynamicToken.refreshIntervalSeconds * 2
          : 90
      );
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
        width: 240,
        margin: 1,
        color: {
          dark: "#0a0a0f",
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-violet-500 selection:text-white relative overflow-hidden">
      {/* Background ambient glowing gradients */}
      <div className="absolute top-1/4 -left-32 w-80 h-80 bg-violet-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Pass Card Container */}
        <div className="bg-[#131622] rounded-3xl border border-white/[0.1] shadow-2xl shadow-black/80 overflow-hidden transition-all backdrop-blur-xl">
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white text-center relative overflow-hidden">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Dumbbell className="w-5 h-5 text-violet-200" />
              <span className="font-extrabold tracking-tight text-base">
                {passData?.member?.firstName
                  ? `${passData.member.firstName}'s Pass`
                  : "GymOS Digital Pass"}
              </span>
            </div>
            <p className="text-[10px] text-violet-200/80 uppercase tracking-widest font-semibold flex items-center justify-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Official Member Pass
            </p>
          </div>

          {/* Main Card Content */}
          <div className="p-6 text-center">
            {loading ? (
              <div className="py-16 space-y-3">
                <Loader2 className="w-10 h-10 text-violet-500 animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-400">
                  Loading secure member credentials...
                </p>
              </div>
            ) : error ? (
              <div className="py-12 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto text-rose-500">
                  <XCircle className="w-8 h-8" />
                </div>
                <h2 className="text-base font-bold text-white">
                  Pass Unavailable
                </h2>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {error}
                </p>
                <div className="pt-2">
                  <button
                    onClick={fetchPass}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </div>
              </div>
            ) : passData?.pass?.status === PassStatus.REVOKED ? (
              <div className="py-12 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto text-rose-500">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h2 className="text-base font-bold text-rose-400">
                  Pass Revoked
                </h2>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  This access pass has been revoked by front-desk staff. Please visit the reception desk to reactivate your credentials.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Member Profile */}
                <div>
                  <h1 className="text-xl font-extrabold text-white tracking-tight">
                    {passData?.member.firstName}
                  </h1>
                  <span className="text-xs font-mono font-semibold text-slate-400">
                    MEMBER ID: {passData?.member.memberNumber}
                  </span>
                </div>

                {/* QR Code Canvas Box with high contrast */}
                <div className="relative mx-auto w-64 h-64 bg-white p-3 rounded-2xl border-2 border-white/20 shadow-inner flex items-center justify-center">
                  <canvas ref={canvasRef} className="rounded-lg" />
                  {refreshing && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-xs rounded-2xl flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                    </div>
                  )}
                </div>

                {/* Security Status Badge & Rolling Countdown */}
                <div className="flex flex-col items-center gap-2 pt-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Dynamic Rotating Token</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
                    <span>Auto-rotates in <strong className="text-white">{secondsRemaining}s</strong></span>
                    <button
                      onClick={refreshToken}
                      disabled={refreshing}
                      className="p-1 text-slate-400 hover:text-white transition-colors ml-1"
                      title="Refresh token now"
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 pt-3 border-t border-white/[0.06]">
                  Hold this QR code directly in front of the scanner camera at the reception desk to check in.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-4 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-violet-400" />
          <span>GymOS Secure Mobile Pass • Cryptographically Signed</span>
        </div>
      </div>
    </div>
  );
}
