"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, QrCode, Calendar, Activity, Utensils } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function MemberPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { label: "Pass & Home", href: "/portal", icon: QrCode },
    { label: "Attendance", href: "/portal/attendance", icon: Calendar },
    { label: "Workouts", href: "/portal/workouts", icon: Activity },
    { label: "Diet Plan", href: "/portal/diet", icon: Utensils },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between max-w-md mx-auto border-x border-white/[0.08] shadow-2xl">
      {/* Member Portal Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.08] bg-slate-900/90 px-4 backdrop-blur">
        <Link href="/portal" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <Dumbbell className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white">
              GymOS Member
            </span>
            <span className="text-[10px] text-emerald-400 block -mt-1 font-mono">
              Self-Service Portal
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-20">{children}</main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto border-t border-white/[0.08] bg-slate-900/95 backdrop-blur z-50 flex items-center justify-around py-2 px-1">
        {navItems.map((item) => {
          const ItemIcon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
                active
                  ? "text-emerald-400 font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <ItemIcon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
