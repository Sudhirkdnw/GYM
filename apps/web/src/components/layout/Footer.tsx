"use client";

import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();

  // Hide footer inside authenticated dashboard and public pass views
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/pass")) {
    return null;
  }

  return (
    <footer className="border-t border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0e1017] py-8">
      <div className="container mx-auto px-4 text-center text-sm text-slate-500 dark:text-zinc-400">
        <p>
          &copy; {new Date().getFullYear()} GymOS SaaS. Automation-First Multi-Tenant Gym Management.
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
          Enterprise SaaS Edition
        </p>
      </div>
    </footer>
  );
}
