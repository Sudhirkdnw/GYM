"use client";

import Link from "next/link";
import { Dumbbell, LogOut, Building2, User, Users } from "lucide-react";
import { Button } from "../ui/button";
import { useAuth } from "@/lib/auth-context";
import { BranchSelector } from "./BranchSelector";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  const { user, organization, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-xl tracking-tight text-emerald-600"
        >
          <Dumbbell className="h-6 w-6" />
          <span>GymOS</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/health"
            className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mr-2"
          >
            System Status
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {organization && (
                <>
                  <Link
                    href="/select-organization"
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                    title="Switch Organization"
                  >
                    <Building2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold">{organization.name}</span>
                    <span className="text-[10px] uppercase text-zinc-500 dark:text-zinc-400">
                      ({organization.role})
                    </span>
                  </Link>

                  <BranchSelector />

                  <Link
                    href="/dashboard/members"
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                    title="Members Directory"
                  >
                    <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Members</span>
                  </Link>
                </>
              )}

              <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <User className="h-3.5 w-3.5" />
                <span>{user?.firstName || user?.email}</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-zinc-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 gap-1 text-xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>

              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5" />
              <ThemeToggle />
            </div>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Get Started
                </Button>
              </Link>

              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5" />
              <ThemeToggle />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
