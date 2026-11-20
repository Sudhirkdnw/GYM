"use client";

import React from "react";
import Link from "next/link";
import { Dumbbell, ArrowLeft } from "lucide-react";

export default function MemberWorkoutsPage() {
  const exercises = [
    { name: "Barbell Squats", sets: "4 Sets", reps: "10-12 Reps", target: "Quads & Glutes" },
    { name: "Incline Dumbbell Press", sets: "3 Sets", reps: "10-12 Reps", target: "Upper Chest" },
    { name: "Lat Pulldown", sets: "4 Sets", reps: "12 Reps", target: "Back / Lats" },
    { name: "Romanian Deadlift", sets: "3 Sets", reps: "10 Reps", target: "Hamstrings" },
  ];

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
          <Dumbbell className="h-5 w-5 text-blue-400" />
          <span>Assigned Workout Routine</span>
        </h1>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-slate-900/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Hypertrophy Split A</h2>
            <p className="text-[11px] text-zinc-400">Target: Full Body Conditioning</p>
          </div>
          <span className="rounded-full bg-blue-950/60 border border-blue-500/40 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
            Assigned by Trainer
          </span>
        </div>

        <div className="space-y-2.5 mt-4">
          {exercises.map((ex, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-white/[0.05] bg-slate-950/50 p-3 flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-white">{ex.name}</p>
                <p className="text-[10px] text-zinc-400">{ex.target}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono font-bold text-blue-300">{ex.sets}</p>
                <p className="text-[10px] text-zinc-500 font-mono">{ex.reps}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
