"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { apiClient } from "@/lib/api-client";
import { KioskTokenResponse } from "@gymos/shared-types";
import {
  QrCode,
  Maximize2,
  Minimize2,
  Printer,
  RefreshCw,
  ArrowLeft,
  Sparkles,
  ExternalLink,
  Building2,
  Calendar,
} from "lucide-react";

export default function KioskCounterQrPage() {
  const [data, setData] = useState<KioskTokenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Kiosk Token
  const fetchToken = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const res = await apiClient<KioskTokenResponse>("/attendance/kiosk/token");
      setData(res);

      if (canvasRef.current && res.checkInUrl) {
        await QRCode.toCanvas(canvasRef.current, res.checkInUrl, {
          width: 340,
          margin: 2,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        });
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load counter QR token");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Redraw QR when canvas is available
  useEffect(() => {
    if (data?.checkInUrl && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, data.checkInUrl, {
        width: 340,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      }).catch(console.error);
    }
  }, [data]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  return (
    <div className={`space-y-6 ${isFullscreen ? "p-8 max-w-4xl mx-auto flex flex-col justify-center min-h-screen" : ""}`}>
      {/* Header bar */}
      {!isFullscreen && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/attendance"
              className="p-2 rounded-lg bg-surface border border-border text-foreground-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <QrCode className="w-6 h-6 text-primary-500" />
                Desk Counter Attendance QR
              </h1>
              <p className="text-sm text-foreground-muted">
                Display this QR code at your reception counter or tablet. Members scan to mark attendance self-service.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print QR Standee
            </button>

            <button
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
              Kiosk Fullscreen
            </button>

            <button
              onClick={fetchToken}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-500 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh Token
            </button>
          </div>
        </div>
      )}

      {/* Main Kiosk Card */}
      <div className="relative rounded-2xl border border-border bg-gradient-to-b from-surface to-surface-hover/80 p-8 shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />

        {isFullscreen && (
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-surface/80 border border-border text-foreground hover:bg-surface transition-colors"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center text-center max-w-xl mx-auto space-y-6">
          {/* Gym & Branch info */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-xs font-semibold text-primary-400 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Self-Service Check-In Counter
            </div>
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
              {data?.organizationName || "GymOS Fitness Club"}
            </h2>
            <div className="flex items-center justify-center gap-4 text-sm text-foreground-muted">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Building2 className="w-4 h-4 text-primary-400" />
                {data?.branchName || "Main Branch"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                Valid Today: {data?.date || new Date().toISOString().slice(0, 10)}
              </span>
              <span>•</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface border border-border text-foreground-muted">
                {currentTime}
              </span>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="relative group">
            <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-primary-500/30 group-hover:border-primary-500 transition-colors">
              {loading ? (
                <div className="w-[340px] h-[340px] flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
              ) : error ? (
                <div className="w-[340px] h-[340px] flex flex-col items-center justify-center p-6 text-center text-rose-500">
                  <p className="font-medium text-sm">{error}</p>
                  <button
                    onClick={fetchToken}
                    className="mt-3 px-3 py-1 text-xs rounded bg-rose-500/10 text-rose-600 font-semibold"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <canvas ref={canvasRef} className="rounded-lg" />
              )}
            </div>

            {/* Live pulsing badge */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              Active Desk QR
            </div>
          </div>

          {/* Member Instructions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-4">
            <div className="p-3 rounded-xl bg-surface/50 border border-border text-left space-y-1">
              <div className="w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-xs font-bold">
                1
              </div>
              <p className="text-xs font-semibold text-foreground">Scan with Camera</p>
              <p className="text-[11px] text-foreground-muted">
                Open phone camera and point at this counter QR code.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-surface/50 border border-border text-left space-y-1">
              <div className="w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-xs font-bold">
                2
              </div>
              <p className="text-xs font-semibold text-foreground">Enter Phone No.</p>
              <p className="text-[11px] text-foreground-muted">
                Type your registered phone number or Member ID.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-surface/50 border border-border text-left space-y-1">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                3
              </div>
              <p className="text-xs font-semibold text-foreground">Instant Check-In</p>
              <p className="text-[11px] text-foreground-muted">
                Verification complete! Enjoy your workout.
              </p>
            </div>
          </div>

          {/* Test Link */}
          {data?.checkInUrl && (
            <div className="pt-2">
              <a
                href={data.checkInUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 underline font-medium"
              >
                Test member check-in screen in browser
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
