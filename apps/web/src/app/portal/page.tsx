"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  QrCode,
  CalendarCheck,
  Sparkles,
  ShieldCheck,
  Dumbbell,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MemberPortalHomePage() {
  const [passTokenInput, setPassTokenInput] = useState("");
  const [savedToken, setSavedToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("gymos_member_pass_token");
      if (stored) {
        setSavedToken(stored);
      }
    } catch {
      // Ignore localStorage access failures
    }
  }, []);

  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passTokenInput.trim()) return;
    try {
      localStorage.setItem("gymos_member_pass_token", passTokenInput.trim());
      setSavedToken(passTokenInput.trim());
    } catch {
      // Ignore localStorage access failures
    }
  };

  return (
    <div className="space-y-6">
      {/* Member Hero Banner */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 p-5 shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-emerald-900/60 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              Active Member Pass
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              GymOS Portal
            </span>
          </div>

          <h2 className="text-xl font-bold text-white mt-3">
            Welcome to Your Gym
          </h2>
          <p className="text-xs text-zinc-300 mt-1">
            Access your digital QR pass, attendance logs, workouts, and nutrition plans from your phone.
          </p>

          {savedToken ? (
            <div className="mt-5">
              <Link
                href={`/pass/${savedToken}`}
                className="w-full inline-flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs h-10 gap-2 shadow-lg shadow-emerald-900/40 transition-colors"
              >
                <QrCode className="h-4 w-4" />
                <span>Open Live Rotating Pass QR</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSaveToken} className="mt-4 space-y-2">
              <label className="text-[11px] text-zinc-300 block">
                Link Your Member Pass Token:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste pass token from SMS / WhatsApp..."
                  value={passTokenInput}
                  onChange={(e) => setPassTokenInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 h-8 shrink-0"
                >
                  Link Pass
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Quick Services Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Attendance */}
        <Link
          href="/portal/attendance"
          className="rounded-xl border border-white/[0.08] bg-slate-900/60 p-4 hover:border-emerald-500/40 transition-colors flex flex-col justify-between"
        >
          <div className="h-9 w-9 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-xs text-white">Attendance Log</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              View your check-in sessions
            </p>
          </div>
        </Link>

        {/* Counter QR Checkin */}
        <Link
          href="/checkin"
          className="rounded-xl border border-white/[0.08] bg-slate-900/60 p-4 hover:border-emerald-500/40 transition-colors flex flex-col justify-between"
        >
          <div className="h-9 w-9 rounded-lg bg-violet-950/60 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-2">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-xs text-white">Self Check-in</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Scan counter QR to enter
            </p>
          </div>
        </Link>

        {/* Workouts */}
        <Link
          href="/portal/workouts"
          className="rounded-xl border border-white/[0.08] bg-slate-900/60 p-4 hover:border-emerald-500/40 transition-colors flex flex-col justify-between"
        >
          <div className="h-9 w-9 rounded-lg bg-blue-950/60 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-2">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-xs text-white">Workout Plan</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Assigned gym routines
            </p>
          </div>
        </Link>

        {/* Nutrition */}
        <Link
          href="/portal/diet"
          className="rounded-xl border border-white/[0.08] bg-slate-900/60 p-4 hover:border-emerald-500/40 transition-colors flex flex-col justify-between"
        >
          <div className="h-9 w-9 rounded-lg bg-amber-950/60 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-xs text-white">Diet Plan</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Calories & macros
            </p>
          </div>
        </Link>
      </div>

      {/* Security Info */}
      <div className="p-3.5 rounded-xl border border-white/[0.06] bg-slate-900/40 text-xs text-zinc-400 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed">
          Your digital access pass uses time-based cryptographic signatures. Dynamic QR codes refresh every 90 seconds to prevent unauthorized screenshot sharing.
        </p>
      </div>
    </div>
  );
}
