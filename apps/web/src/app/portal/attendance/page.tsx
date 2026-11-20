"use client";

import React from "react";
import Link from "next/link";
import { CalendarCheck, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function MemberAttendancePage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/portal"
          className="inline-flex items-center justify-center rounded-md p-1 h-8 w-8 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-emerald-400" />
          <span>Attendance History</span>
        </h1>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-slate-900/60 p-4">
        <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
          Recent Check-in Sessions
        </h2>

        <div className="space-y-3">
          <div className="rounded-lg border border-white/[0.05] bg-slate-950/50 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Main Fitness Floor</p>
                <p className="text-[10px] text-zinc-400">Today • Dynamic Pass QR</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-emerald-400">COMPLETED</span>
              <p className="text-[10px] text-zinc-500">Duration: 75 mins</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
