"use client";

import React from "react";
import Link from "next/link";
import { Utensils, ArrowLeft } from "lucide-react";

export default function MemberDietPage() {
  const meals = [
    { name: "Breakfast (8:00 AM)", items: "Oats with Whey Protein, Almonds & Banana", calories: "450 kcal" },
    { name: "Lunch (1:30 PM)", items: "Grilled Chicken Breast, Brown Rice & Mixed Greens", calories: "600 kcal" },
    { name: "Evening Snack (5:30 PM)", items: "Boiled Eggs (3) & Green Tea", calories: "220 kcal" },
    { name: "Dinner (8:30 PM)", items: "Paneer / Tofu Tikka with Sautéed Vegetables", calories: "400 kcal" },
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
          <Utensils className="h-5 w-5 text-amber-400" />
          <span>Diet & Nutrition Plan</span>
        </h1>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-slate-900/60 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-white">Daily Calorie Target</h2>
            <p className="text-[11px] text-zinc-400">Lean Muscle Gain Protocol</p>
          </div>
          <div className="text-right">
            <span className="text-base font-extrabold text-amber-400">1,670</span>
            <span className="text-[10px] text-zinc-400 block font-mono">kcal / day</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/[0.05] text-center text-xs">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase block">Protein</span>
            <span className="font-bold text-white">140g</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase block">Carbs</span>
            <span className="font-bold text-white">160g</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase block">Fats</span>
            <span className="font-bold text-white">45g</span>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          {meals.map((meal, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-white/[0.05] bg-slate-950/50 p-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white">{meal.name}</p>
                <span className="text-[10px] font-mono font-bold text-amber-300">
                  {meal.calories}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">{meal.items}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
