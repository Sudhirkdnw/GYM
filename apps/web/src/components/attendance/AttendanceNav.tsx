"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Permission } from "@gymos/shared-types";
import {
  Users,
  QrCode,
  History,
  Sliders,
} from "lucide-react";

export function AttendanceNav() {
  const pathname = usePathname();
  const { organization } = useAuth();

  const permissions = organization?.permissions || [];
  const canManageSettings = permissions.includes(Permission.ATTENDANCE_SETTINGS_MANAGE);
  const canCheckIn = permissions.includes(Permission.ATTENDANCE_CHECKIN) || permissions.includes(Permission.ATTENDANCE_MANUAL);

  const navItems = [
    {
      name: "Live Floor",
      href: "/dashboard/attendance",
      icon: Users,
      exact: true,
      show: true,
    },
    {
      name: "Front-Desk Scanner",
      href: "/dashboard/attendance/scanner",
      icon: QrCode,
      exact: false,
      show: canCheckIn,
    },
    {
      name: "Ledger & History",
      href: "/dashboard/attendance/history",
      icon: History,
      exact: false,
      show: true,
    },
    {
      name: "Policy Settings",
      href: "/dashboard/attendance/settings",
      icon: Sliders,
      exact: false,
      show: canManageSettings,
    },
  ];

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-2xl border bg-slate-100/80 border-slate-200/80 dark:bg-white/[0.04] dark:border-white/[0.08] mb-6">
      {navItems
        .filter((item) => item.show)
        .map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-white text-slate-900 shadow-sm dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:text-white dark:shadow-glow dark:shadow-violet-500/25"
                  : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.04]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
    </div>
  );
}
