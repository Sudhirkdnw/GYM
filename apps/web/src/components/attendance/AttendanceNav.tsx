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
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-6">
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
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
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
