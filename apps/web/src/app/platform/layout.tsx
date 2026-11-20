"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  ShieldCheck,
  Building2,
  Package,
  Layers,
  ArrowLeft,
  LogOut,
  LayoutDashboard,
  Menu,
  X,
  Activity,
  AlertOctagon,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";

interface NavLinkItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navLinks: NavLinkItem[] = [
    {
      label: "Platform Overview",
      href: "/platform",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: "Gym Organizations",
      href: "/platform/organizations",
      icon: Building2,
    },
    {
      label: "SaaS Plans",
      href: "/platform/plans",
      icon: Package,
    },
    {
      label: "Feature Catalog",
      href: "/platform/features",
      icon: Layers,
    },
  ];

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="text-xs text-zinc-400 font-mono tracking-wider">
            AUTHENTICATING PLATFORM ADMIN...
          </p>
        </div>
      </div>
    );
  }

  // Super Admin security gate
  if (!isAuthenticated || !user?.isSuperAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#090a0f] p-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-950/60 border border-red-500/40 text-red-400 mb-4">
          <AlertOctagon className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-white">Access Restricted</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-400">
          The Platform Administration Console is restricted exclusively to authorized GymOS Super Administrators.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Button
            onClick={() => router.push("/select-organization")}
            className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Gym Workspaces
          </Button>
          <Button
            variant="outline"
            onClick={() => logout()}
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-900"
          >
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0c12] text-zinc-100 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-white/[0.08] bg-[#0d0e15]/90 px-4 sm:px-6 backdrop-blur">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05]"
          >
            {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/platform" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-glow shadow-violet-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  GymOS
                </span>
                <span className="rounded bg-violet-950/80 border border-violet-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-300">
                  PLATFORM ADMIN
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono tracking-wider">
                SaaS Control Plane
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/health"
            className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-2.5 py-1 rounded-lg border border-white/[0.05] hover:bg-white/[0.03]"
          >
            <Activity className="h-3 w-3 text-emerald-400" />
            <span>Health</span>
          </Link>

          <Link
            href="/select-organization"
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-violet-400" />
            <span>Tenant Workspaces</span>
          </Link>

          <div className="h-5 w-px bg-white/[0.08]" />

          <ThemeToggle />

          <div className="hidden md:flex items-center gap-2 pl-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-bold uppercase">
              {user.firstName ? user.firstName[0] : "A"}
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-white leading-tight">
                {user.firstName || "Platform"} {user.lastName || "Admin"}
              </p>
              <p className="text-[10px] text-zinc-400 truncate max-w-[130px]">
                {user.email}
              </p>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Body with Sidebar + Content */}
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.08] bg-[#0d0e15] p-4 shrink-0">
          <div className="mb-4 px-3 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
            SAAS MANAGEMENT
          </div>
          <nav className="space-y-1 flex-1">
            {navLinks.map((item) => {
              const ItemIcon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    active
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-glow shadow-violet-500/20 font-semibold"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
                  }`}
                >
                  <ItemIcon
                    className={`h-4 w-4 shrink-0 ${
                      active ? "text-white" : "text-zinc-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Platform Invariant Note */}
          <div className="p-3 rounded-xl bg-violet-950/30 border border-violet-500/20 text-violet-300 text-[11px] leading-relaxed">
            <p className="font-semibold text-white flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-violet-400" />
              <span>Authoritative Gate</span>
            </p>
            Changes take effect immediately across all tenant sessions with Redis cache purge.
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsMobileOpen(false)}
            />
            <div className="relative flex flex-col w-64 max-w-[80%] bg-[#0d0e15] border-r border-white/[0.1] p-4 z-10">
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Navigation
                </span>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1 rounded text-zinc-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-4 space-y-1 flex-1">
                {navLinks.map((item) => {
                  const ItemIcon = item.icon;
                  const active = isActive(item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        active
                          ? "bg-violet-600 text-white font-semibold"
                          : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <ItemIcon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Main Workspace Area */}
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
